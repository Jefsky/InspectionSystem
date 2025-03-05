// 更新特定网站的脚本
const { Website } = require('./models');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// 从index.js复制的函数
const sanitizeCertificateInfo = (info) => {
  if (!info) return null;
  
  // 创建一个新对象，过滤掉可能包含编码问题的值
  const sanitized = {};
  
  for (const [key, value] of Object.entries(info)) {
    // 如果值是字符串，检查是否包含可能的乱码
    if (typeof value === 'string') {
      // 检查是否包含不可打印字符或问号（通常表示编码问题）
      const containsUnprintable = /[\u0000-\u001F\u007F-\u009F\uFFFD]/.test(value);
      const containsQuestionMarks = value.includes('?');
      
      if (!containsUnprintable && !containsQuestionMarks) {
        sanitized[key] = value;
      } else if (key === 'CN') {
        // 对于CN字段，即使有问题也保留，因为这是最重要的字段
        sanitized[key] = value.replace(/[\u0000-\u001F\u007F-\u009F\uFFFD]/g, '');
      }
    } else {
      // 非字符串值直接保留
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

const checkUrl = async (domain, protocol = 'https') => {
  return new Promise(async (resolve, reject) => {
    try {
      const url = `${protocol}://${domain}`;
      console.log(`检查URL: ${url}`);
      
      const startTime = Date.now();
      let isAccessible = false;
      let sslStatus = 'none';
      let error = null;
      let certificateInfo = null;
      let statusCode = null;
      
      const httpModule = protocol === 'https' ? https : http;
      
      // 设置请求选项
      const options = {
        method: 'HEAD',
        timeout: 10000, // 10秒超时
        rejectUnauthorized: false // 允许自签名证书
      };
      
      const req = httpModule.request(url, options, (res) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        isAccessible = true;
        statusCode = res.statusCode;
        
        // 对于HTTPS请求，获取证书信息
        if (protocol === 'https') {
          try {
            const certificate = res.socket?.getPeerCertificate(true);
            if (!certificate || Object.keys(certificate).length === 0) {
              sslStatus = 'invalid';
              error = '无法获取SSL证书信息';
            } else {
              // 解析证书日期
              let validFrom = null;
              let validTo = null;
              
              try {
                if (certificate.valid_from) {
                  validFrom = new Date(certificate.valid_from);
                }
                if (certificate.valid_to) {
                  validTo = new Date(certificate.valid_to);
                }
              } catch (dateError) {
                console.error('日期解析错误:', dateError);
              }
              
              const now = new Date();
              
              // 检查是否自签名
              const isSelfSigned = certificate.issuer.CN === certificate.subject.CN;
              
              if (isSelfSigned) {
                sslStatus = 'invalid';
                error = '自签名证书（无效）';
              } else if (validFrom && validTo) {
                if (now < validFrom) {
                  sslStatus = 'invalid';
                  error = '证书尚未生效';
                } else if (now > validTo) {
                  sslStatus = 'expired';
                  error = '证书已过期';
                } else {
                  sslStatus = 'valid';
                  error = null;
                }
              } else {
                sslStatus = 'invalid';
                error = '无效的证书日期';
              }
              
              const daysRemaining = validTo ? Math.ceil((validTo - now) / (1000 * 60 * 60 * 24)) : 0;
              
              certificateInfo = {
                issuer: sanitizeCertificateInfo(certificate.issuer),
                subject: sanitizeCertificateInfo(certificate.subject),
                validFrom: validFrom ? validFrom.toISOString() : null,
                validTo: validTo ? validTo.toISOString() : null,
                daysRemaining,
                isSelfSigned
              };
            }
          } catch (certError) {
            console.error('证书处理错误:', certError);
            sslStatus = 'invalid';
            error = '证书处理错误: ' + certError.message;
          }
        }
        
        resolve({
          lastCheck: new Date(),
          isAccessible,
          sslStatus,
          protocol,
          error,
          certificateInfo,
          responseTime,
          statusCode
        });
      });
      
      req.on('error', (e) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.error(`请求错误: ${e.message}`);
        
        if (e.code === 'ENOTFOUND') {
          error = '域名无法解析';
        } else if (e.code === 'ETIMEDOUT' || e.code === 'ESOCKETTIMEDOUT') {
          error = '请求超时';
        } else if (e.code === 'ECONNREFUSED') {
          error = '连接被拒绝';
        } else if (e.code === 'CERT_HAS_EXPIRED') {
          sslStatus = 'expired';
          error = '证书已过期';
        } else if (e.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || e.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
          sslStatus = 'invalid';
          error = '自签名证书（无效）';
        } else {
          error = `请求失败: ${e.message}`;
        }
        
        resolve({
          lastCheck: new Date(),
          isAccessible: false,
          sslStatus,
          protocol,
          error,
          certificateInfo: null,
          responseTime,
          statusCode: null
        });
      });
      
      req.end();
    } catch (e) {
      console.error('检查URL时出错:', e);
      resolve({
        lastCheck: new Date(),
        isAccessible: false,
        sslStatus: 'none',
        protocol,
        error: `检查失败: ${e.message}`,
        certificateInfo: null,
        responseTime: null,
        statusCode: null
      });
    }
  });
};

// 主函数
async function updateWebsite(domain) {
  try {
    const website = await Website.findOne({ where: { domain } });
    
    if (!website) {
      console.error(`未找到网站: ${domain}`);
      return;
    }
    
    console.log(`开始检查网站: ${domain}`);
    const result = await checkUrl(website.domain, website.protocol);
    console.log('检查结果:', JSON.stringify(result, null, 2));
    
    await website.update(result);
    console.log('更新成功!');
    
    // 获取更新后的网站数据
    const updatedWebsite = await Website.findOne({ where: { domain } });
    console.log('更新后的网站数据:', JSON.stringify(updatedWebsite, null, 2));
  } catch (e) {
    console.error('更新网站时出错:', e);
  } finally {
    process.exit(0);
  }
}

// 从命令行参数获取域名
const domain = process.argv[2];

if (!domain) {
  console.error('请提供网站域名作为参数');
  process.exit(1);
}

updateWebsite(domain);
