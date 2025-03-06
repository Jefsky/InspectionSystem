const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const tls = require('tls');
const path = require('path'); // 添加path模块
const { Website, initDatabase } = require('./models');
const app = express();

app.use(cors());
app.use(express.json());

// 添加静态文件服务
app.use(express.static(path.join(__dirname, '../src')));

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

// 获取网站统计数据
app.get('/statistics', async (req, res) => {
  try {
    console.log('获取网站统计数据请求')
    const websites = await Website.findAll();
    
    // 初始化统计对象
    const stats = {
      totalCount: websites.length,
      accessibleCount: 0,
      inaccessibleCount: 0,  // 添加不可访问网站计数
      sslValidCount: 0,
      avgResponseTime: 0,
      statusCodes: {},
      sslStatus: {},
      sslValid: 0,
      sslExpiringSoon: 0,
      sslExpired: 0,
      sslSelfSigned: 0,
      sslNone: 0,
      accessibilityRate: 0, // 添加accessibilityRate字段
      recentlyUpdated: [],
      lastCheck: new Date().toISOString()  // 使用ISO字符串格式
    };
    
    // 计算可访问和SSL有效的网站数量
    websites.forEach(website => {
      if (website.isAccessible) {
        stats.accessibleCount++;
        if (website.responseTime) {
          stats.avgResponseTime += website.responseTime;
        }
      } else {
        stats.inaccessibleCount++;  // 计算不可访问网站数量
      }
      
      if (website.sslStatus === 'valid') {
        stats.sslValidCount++;
      }
      
      // 统计SSL状态
      if (website.sslStatus) {
        if (!stats.sslStatus[website.sslStatus]) {
          stats.sslStatus[website.sslStatus] = 0;
        }
        stats.sslStatus[website.sslStatus]++;
        
        // 为图表添加具体的SSL状态计数
        switch(website.sslStatus) {
          case 'valid':
            stats.sslValid++;
            break;
          case 'expiring_soon':
            stats.sslExpiringSoon++;
            break;
          case 'expired':
            stats.sslExpired++;
            break;
          case 'invalid':
          case 'self_signed':
            stats.sslSelfSigned++;
            break;
          case 'none':
          default:
            stats.sslNone++;
            break;
        }
      } else {
        // 如果没有SSL状态，计为无SSL
        stats.sslNone++;
      }
      
      // 统计状态码
      if (website.statusCode) {
        if (!stats.statusCodes[website.statusCode]) {
          stats.statusCodes[website.statusCode] = 0;
        }
        stats.statusCodes[website.statusCode]++;
      }
    });
    
    // 计算平均响应时间
    if (stats.accessibleCount > 0) {
      stats.avgResponseTime = Math.round(stats.avgResponseTime / stats.accessibleCount);
    }
    
    // 计算可访问性率
    if (stats.totalCount > 0) {
      stats.accessibilityRate = Math.round((stats.accessibleCount / stats.totalCount) * 100);
    }
    
    // 获取最近更新的5个网站
    const recentlyUpdated = [...websites]
      .sort((a, b) => new Date(b.lastCheck || 0) - new Date(a.lastCheck || 0))
      .slice(0, 5)
      .map(site => ({
        id: site.id,
        domain: site.domain,
        title: site.title || site.domain,
        lastCheck: site.lastCheck,
        isAccessible: site.isAccessible,
        responseTime: site.responseTime,
        statusCode: site.statusCode
      }));
    
    stats.recentlyUpdated = recentlyUpdated;
    
    console.log('统计数据:', JSON.stringify(stats, null, 2));
    res.setHeader('Content-Type', 'application/json');
    return res.json(stats);
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: '获取统计数据失败: ' + error.message });
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
      
      // 开始计时
      const startTime = Date.now();
      
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
        // 计算响应时间
        const responseTime = Date.now() - startTime;
        console.log(`网站 ${domain} 响应时间: ${responseTime}ms`);
        
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
              } catch (e) {
                console.error('证书日期解析错误:', e);
                validFrom = null;
                validTo = null;
              }
              
              const daysRemaining = validTo ? Math.ceil((validTo - now) / (1000 * 60 * 60 * 24)) : 0;
              
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
          isAccessible,
          protocol: isHttps ? 'https' : 'http',
          sslStatus,
          certificateInfo,
          error,
          lastCheck: new Date(),
          responseTime,
          statusCode
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
          lastCheck: new Date(),
          responseTime: null,
          statusCode: null
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
          lastCheck: new Date(),
          responseTime: null,
          statusCode: null
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
        lastCheck: new Date(),
        responseTime: null,
        statusCode: null
      });
    }
  });
};

const checkWebsite = async (domain, protocol = 'https') => {
  try {
    // 先尝试使用指定的协议
    const result = await checkUrl(domain, protocol);
    
    // 如果使用HTTPS失败且协议是HTTPS，则尝试使用HTTP
    if (!result.isAccessible && protocol === 'https') {
      console.log(`HTTPS连接失败，尝试使用HTTP连接 ${domain}`);
      const httpResult = await checkUrl(domain, 'http');
      return httpResult;
    }
    
    return result;
  } catch (error) {
    console.error(`检查网站 ${domain} 出错:`, error);
    return {
      isAccessible: false,
      error: error.message,
      lastCheck: new Date(),
      responseTime: null,
      statusCode: null
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
            lastCheck: new Date(),
            responseTime: null,
            statusCode: null
          };
        }
      })
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: '批量检查失败：' + error.message });
  }
});

// 刷新所有网站
app.post('/refresh-all', async (req, res) => {
  try {
    console.log('开始刷新所有网站');
    const websites = await Website.findAll();
    const results = [];
    const now = new Date(); // 使用同一个时间戳
    
    for (const website of websites) {
      try {
        console.log(`刷新网站: ${website.domain}`);
        const checkResult = await checkWebsite(website.domain);
        console.log(`更新网站 ${website.domain} 的最后检查时间:`, now.toISOString());
        await website.update({
          ...checkResult,
          lastCheck: now.toISOString()  // 使用ISO字符串格式存储时间
        });
        const updatedWebsite = await website.reload();
        results.push(updatedWebsite);
      } catch (error) {
        console.error(`刷新网站 ${website.domain} 失败:`, error);
        // 继续处理下一个网站，不中断整个过程
      }
    }
    
    console.log(`成功刷新 ${results.length}/${websites.length} 个网站`);
    
    // 获取最新的统计数据
    const stats = {
      totalCount: 0,
      accessibleCount: 0,
      inaccessibleCount: 0,  // 添加不可访问网站计数
      sslValidCount: 0,
      avgResponseTime: 0,
      statusCodes: {},
      sslStatus: {},
      sslValid: 0,
      sslExpiringSoon: 0,
      sslExpired: 0,
      sslSelfSigned: 0,
      sslNone: 0,
      accessibilityRate: 0, // 添加accessibilityRate字段
      recentlyUpdated: [],
      lastCheck: now.toISOString()
    };
    
    // 重新计算统计数据
    const allWebsites = await Website.findAll();
    stats.totalCount = allWebsites.length;
    
    // 计算可访问网站数量
    stats.accessibleCount = allWebsites.filter(site => site.isAccessible).length;
    stats.inaccessibleCount = allWebsites.filter(site => !site.isAccessible).length;  // 计算不可访问网站数量
    
    // 计算SSL有效的网站数量
    stats.sslValidCount = allWebsites.filter(site => site.sslStatus === 'valid').length;
    
    // 计算平均响应时间
    const responseTimes = allWebsites
      .filter(site => site.responseTime && site.isAccessible)
      .map(site => site.responseTime);
    
    stats.avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length)
      : 0;
    
    // 计算可访问性率
    if (stats.totalCount > 0) {
      stats.accessibilityRate = Math.round((stats.accessibleCount / stats.totalCount) * 100);
    }
    
    // 统计状态码分布
    allWebsites.forEach(site => {
      if (site.statusCode) {
        stats.statusCodes[site.statusCode] = (stats.statusCodes[site.statusCode] || 0) + 1;
      }
    });
    
    // 统计SSL状态分布
    allWebsites.forEach(site => {
      if (site.sslStatus) {
        stats.sslStatus[site.sslStatus] = (stats.sslStatus[site.sslStatus] || 0) + 1;
        
        // 为图表添加具体的SSL状态计数
        switch(site.sslStatus) {
          case 'valid':
            stats.sslValid++;
            break;
          case 'expiring_soon':
            stats.sslExpiringSoon++;
            break;
          case 'expired':
            stats.sslExpired++;
            break;
          case 'invalid':
          case 'self_signed':
            stats.sslSelfSigned++;
            break;
          case 'none':
          default:
            stats.sslNone++;
            break;
        }
      } else {
        // 如果没有SSL状态，计为无SSL
        stats.sslNone++;
      }
    });
    
    // 获取最近更新的网站
    const recentlyUpdated = allWebsites
      .sort((a, b) => new Date(b.lastCheck || 0) - new Date(a.lastCheck || 0))
      .slice(0, 5)
      .map(site => ({
        id: site.id,
        domain: site.domain,
        title: site.title || site.domain,
        lastCheck: site.lastCheck,
        isAccessible: site.isAccessible,
        responseTime: site.responseTime,
        statusCode: site.statusCode
      }));
    
    stats.recentlyUpdated = recentlyUpdated;
    
    console.log('更新后的统计数据:', stats);
    
    // 返回结果和更新的统计数据
    res.json({
      results,
      statistics: stats
    });
  } catch (error) {
    console.error('刷新所有网站失败:', error);
    res.status(500).json({ error: '刷新所有网站失败: ' + error.message });
  }
});

// 刷新单个网站
app.post('/refresh/:id', async (req, res) => {
  try {
    console.log(`刷新网站ID: ${req.params.id}`);
    const website = await Website.findByPk(req.params.id);
    
    if (!website) {
      return res.status(404).json({ error: '网站不存在' });
    }
    
    console.log(`刷新网站: ${website.domain}`);
    const checkResult = await checkWebsite(website.domain, website.protocol || 'https');
    
    // 使用当前时间作为最后检查时间
    const now = new Date();
    console.log(`更新网站 ${website.domain} 的最后检查时间:`, now.toISOString());
    
    await website.update({
      ...checkResult,
      lastCheck: now.toISOString()  // 使用ISO字符串格式存储时间
    });
    
    const updatedWebsite = await website.reload();
    res.json(updatedWebsite);
  } catch (error) {
    console.error(`刷新网站失败:`, error);
    res.status(500).json({ error: '刷新网站失败: ' + error.message });
  }
});

// 切换网站置顶状态
app.post('/websites/:id/toggle-pin', async (req, res) => {
  try {
    console.log(`切换网站ID: ${req.params.id} 的置顶状态`);
    const website = await Website.findByPk(req.params.id);
    
    if (!website) {
      return res.status(404).json({ error: '网站不存在' });
    }
    
    // 切换置顶状态
    const newPinnedStatus = !website.isPinned;
    console.log(`将网站 ${website.domain} 的置顶状态从 ${website.isPinned} 更改为 ${newPinnedStatus}`);
    
    await website.update({
      isPinned: newPinnedStatus
    });
    
    const updatedWebsite = await website.reload();
    res.json(updatedWebsite);
  } catch (error) {
    console.error(`切换网站置顶状态失败:`, error);
    res.status(500).json({ error: '切换网站置顶状态失败: ' + error.message });
  }
});

// 添加根路径路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

const port = 3001;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
