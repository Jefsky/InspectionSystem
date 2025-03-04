const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const tls = require('tls');
const { Website, initDatabase } = require('./models');
const app = express();

app.use(cors());
app.use(express.json());

// 初始化数据库
initDatabase();

// 获取所有网站
app.get('/websites', async (req, res) => {
  try {
    console.log('获取所有网站请求')
    const websites = await Website.findAll({
      order: [['lastCheck', 'DESC']]
    });
    console.log(`找到 ${websites.length} 个网站记录`)
    res.json(websites);
  } catch (error) {
    console.error('获取网站列表失败:', error);
    res.status(500).json({ error: '获取网站列表失败' });
  }
});

// 获取单个网站
app.get('/websites/:id', async (req, res) => {
  try {
    const website = await Website.findByPk(req.params.id);
    if (!website) {
      return res.status(404).json({ error: '网站不存在' });
    }
    res.json(website);
  } catch (error) {
    console.error('获取网站出错:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新网站信息
app.put('/websites/:id', async (req, res) => {
  try {
    const { title, domain, protocol } = req.body;
    
    // 验证域名格式
    if (!domain || domain.trim() === '') {
      return res.status(400).json({ error: '域名不能为空' });
    }
    
    // 查找网站
    const website = await Website.findByPk(req.params.id);
    if (!website) {
      return res.status(404).json({ error: '网站不存在' });
    }
    
    // 更新网站信息
    await website.update({
      title: title || domain,
      domain,
      protocol: protocol || 'https'
    });
    
    res.json(website);
  } catch (error) {
    console.error('更新网站出错:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除网站
app.delete('/website/:id', async (req, res) => {
  try {
    const website = await Website.findByPk(req.params.id);
    if (website) {
      await website.destroy();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '网站不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新网站信息
app.put('/website/:id', async (req, res) => {
  try {
    const website = await Website.findByPk(req.params.id);
    if (website) {
      const { domain, title } = req.body;
      await website.update({ domain, title });
      const checkResult = await checkWebsite(domain);
      await website.update({
        ...checkResult,
        lastCheck: new Date()
      });
      res.json(await website.reload());
    } else {
      res.status(404).json({ error: '网站不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const isValidDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') {
    console.log('Invalid date input:', dateStr);
    return false;
  }
  
  // 打印原始日期字符串，用于调试
  console.log('Certificate date string:', dateStr);
  
  try {
    const date = new Date(dateStr);
    const isValid = !isNaN(date.getTime());
    console.log('Parsed date:', date, 'isValid:', isValid);
    return isValid;
  } catch (error) {
    console.log('Date parsing error:', error);
    return false;
  }
};

const verifyCertificate = (cert) => {
  if (!cert) {
    return { valid: false, reason: 'no_certificate' };
  }

  try {
    const now = new Date();
    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);

    // 检查日期是否有效
    if (isNaN(validFrom.getTime()) || isNaN(validTo.getTime())) {
      console.log('Invalid date:', { from: cert.valid_from, to: cert.valid_to });
      return { valid: false, reason: 'invalid_date' };
    }

    // 检查证书是否已经生效
    if (now < validFrom) {
      return { valid: false, reason: 'not_yet_valid' };
    }

    // 检查证书是否过期
    if (now > validTo) {
      return { valid: false, reason: 'expired' };
    }

    // 检查是否是自签名证书
    const issuerCN = cert.issuer?.CN || cert.issuer?.O;
    const subjectCN = cert.subject?.CN || cert.subject?.O;
    
    if (!issuerCN || !subjectCN) {
      return { valid: false, reason: 'invalid_cert_info' };
    }

    if (issuerCN === subjectCN) {
      return { valid: false, reason: 'self_signed' };
    }

    return { 
      valid: true,
      daysRemaining: Math.ceil((validTo - now) / (1000 * 60 * 60 * 24))
    };
  } catch (error) {
    console.log('Certificate verification error:', error);
    return { valid: false, reason: 'verification_error', error: error.message };
  }
};

const formatDate = (dateStr) => {
  try {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch (error) {
    return null;
  }
};

const checkUrl = async (domain, protocol = 'https') => {
  return new Promise(async (resolve, reject) => {
    try {
      const url = `${protocol}://${domain}`;
      
      // 选择合适的请求模块
      const requestModule = protocol === 'https' ? https : http;
      
      const req = requestModule.get(url, {
        timeout: 15000, // 增加超时时间到15秒
        rejectUnauthorized: false, // 允许自签名证书
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        agent: new requestModule.Agent({
          keepAlive: true,
          maxSockets: 10, // 限制最大并发连接数
          maxFreeSockets: 2,
          timeout: 15000
        })
      }, (res) => {
        const statusCode = res.statusCode;
        const isAccessible = statusCode >= 200 && statusCode < 400;
        const isHttps = protocol === 'https';
        
        let sslStatus = 'none';
        let certificateInfo = null;
        let error = null;

        if (!isHttps) {
          error = '不安全：未使用HTTPS协议';
          sslStatus = 'none';
        } else {
          try {
            const certificate = res.socket?.getPeerCertificate(true);
            if (!certificate || Object.keys(certificate).length === 0) {
              sslStatus = 'invalid';
              error = '无法获取SSL证书信息';
            } else {
              // 检查证书有效期
              const now = new Date();
              let validFrom, validTo;
              
              try {
                validFrom = new Date(certificate.valid_from);
                validTo = new Date(certificate.valid_to);
                
                if (isNaN(validFrom.getTime()) || isNaN(validTo.getTime())) {
                  sslStatus = 'invalid';
                  error = '证书日期格式无效';
                } else if (now < validFrom) {
                  sslStatus = 'invalid';
                  error = '证书尚未生效';
                } else if (now > validTo) {
                  sslStatus = 'expired';
                  error = '证书已过期';
                } else {
                  // 检查自签名
                  const issuerCN = certificate.issuer?.CN || certificate.issuer?.O;
                  const subjectCN = certificate.subject?.CN || certificate.subject?.O;

                  if (issuerCN === subjectCN) {
                    sslStatus = 'self-signed';
                    error = '不安全：使用自签名证书';
                  } else {
                    sslStatus = 'valid';
                    const daysRemaining = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));
                    
                    if (daysRemaining <= 30) {
                      error = `证书即将过期（剩余 ${daysRemaining} 天）`;
                    }

                    certificateInfo = {
                      issuer: issuerCN || 'Unknown',
                      subject: subjectCN || 'Unknown',
                      validFrom: validFrom.toISOString(),
                      validTo: validTo.toISOString(),
                      daysRemaining,
                      serialNumber: certificate.serialNumber || 'Unknown',
                      fingerprint: certificate.fingerprint || 'Unknown'
                    };
                  }
                }
              } catch (dateError) {
                console.error('Date parsing error:', dateError);
                sslStatus = 'invalid';
                error = '证书日期解析错误';
              }
            }
          } catch (certError) {
            console.error('Certificate processing error:', certError);
            sslStatus = 'invalid';
            error = '证书处理错误: ' + certError.message;
          }
        }

        resolve({
          isAccessible,
          protocol: isHttps ? 'https' : 'http',
          sslStatus,
          certificateInfo,
          error,
          lastCheck: new Date()
        });

        // 确保响应被正确关闭
        res.resume();
      });

      req.on('error', (error) => {
        console.error('Request error:', error);
        resolve({
          isAccessible: false,
          protocol: protocol,
          sslStatus: protocol === 'https' ? 'invalid' : 'none', // 如果是HTTPS但连接失败，标记为invalid
          certificateInfo: null,
          error: `连接失败: ${error.message}`,
          lastCheck: new Date()
        });
      });

      // 设置请求超时
      req.setTimeout(15000, () => {
        req.destroy();
        resolve({
          isAccessible: false,
          protocol: protocol,
          sslStatus: protocol === 'https' ? 'invalid' : 'none', // 如果是HTTPS但超时，标记为invalid
          certificateInfo: null,
          error: '请求超时',
          lastCheck: new Date()
        });
      });

      req.end();
    } catch (error) {
      console.error('检查网站出错:', error);
      resolve({
        isAccessible: false,
        protocol: protocol,
        sslStatus: protocol === 'https' ? 'invalid' : 'none', // 如果是HTTPS但出错，标记为invalid
        certificateInfo: null,
        error: error.message,
        lastCheck: new Date()
      });
    }
  });
};

const checkWebsite = async (domain, protocol = 'https') => {
  try {
    const result = await checkUrl(domain, protocol);
    return result;
  } catch (error) {
    console.error(`检查网站 ${domain} 出错:`, error);
    return {
      isAccessible: false,
      error: error.message
    };
  }
};

app.post('/check', async (req, res) => {
  try {
    const { domain, title, protocol } = req.body;
    
    // 确保域名不包含协议前缀
    let cleanDomain = domain || '';
    let domainProtocol = protocol || 'https';
    
    if (cleanDomain.startsWith('http://')) {
      cleanDomain = cleanDomain.substring(7);
      domainProtocol = 'http';
    } else if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.substring(8);
    }
    
    const result = await checkWebsite(cleanDomain, domainProtocol);
    
    // 检查数据库中是否已存在该域名
    let website = await Website.findOne({ where: { domain: cleanDomain } });
    
    if (website) {
      // 更新现有记录
      await website.update({
        ...result,
        title: title || website.title,
        protocol: domainProtocol,
        lastCheck: new Date()
      });
    } else {
      // 创建新记录
      website = await Website.create({
        domain: cleanDomain,
        title: title || cleanDomain,
        protocol: domainProtocol,
        ...result,
        lastCheck: new Date()
      });
    }
    
    res.json({
      id: website.id,
      domain: cleanDomain,
      title: website.title,
      protocol: domainProtocol,
      ...result
    });
  } catch (error) {
    console.error('检查网站出错:', error);
    res.status(500).json({ error: error.message });
  }
});

// 批量检查网站
app.post('/check-all', async (req, res) => {
  try {
    const websites = await Website.findAll();
    const results = await Promise.all(
      websites.map(async (website) => {
        try {
          const result = await checkWebsite(website.domain);
          await website.update({
            ...result,
            lastCheck: new Date()
          });
          return {
            id: website.id,
            domain: website.domain,
            title: website.title,
            ...result
          };
        } catch (error) {
          // 如果单个网站检查失败，返回错误状态但不中断整个过程
          return {
            id: website.id,
            domain: website.domain,
            title: website.title,
            isAccessible: false,
            error: '检查失败：' + error.message,
            sslStatus: 'none',
            protocol: 'http',
            lastCheck: new Date()
          };
        }
      })
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: '批量检查失败：' + error.message });
  }
});

const port = 3001;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
