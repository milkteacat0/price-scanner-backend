const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');

const app = express();
const upload = multer({ 
  limits: { fileSize: 10 * 1024 * 1024 },
  storage: multer.memoryStorage()
});

// CORS 設定 - 允許所有來源
app.use(cors());

app.use(express.json());

// 初始化 OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 健康檢查
app.get('/', (req, res) => {
  // 檢查環境變數
  const diagnostics = {
    hasApiKey: !!process.env.OPENAI_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    apiKeyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 3) : 'not-set'
  };
  
  console.log('診斷信息:', diagnostics);
  
  res.json({ 
    status: 'ok', 
    message: '萬物價格掃描器 API 運行中',
    diagnostics: diagnostics,
    endpoints: {
      health: '/api/health',
      analyze: '/api/analyze (POST)'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'GPT-4o 價格掃描器 API' });
});

// 添加一個專門的診斷端點
app.get('/api/diagnostics', (req, res) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasApiKey: !!process.env.OPENAI_API_KEY,
      apiKeyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 3) : 'not-set'
    },
    versions: {
      node: process.version,
      openai: require('openai/package.json').version
    }
  };
  
  res.json(diagnostics);
});

// 主要的圖片分析端點
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    console.log('收到分析請求');
    
    if (!req.file) {
      console.log('未提供圖片');
      return res.status(400).json({ 
        success: false,
        error: '請提供圖片' 
      });
    }

    console.log('圖片大小:', req.file.size);

    // 檢查 OpenAI API Key
    if (!process.env.OPENAI_API_KEY) {
      console.error('未設置 OPENAI_API_KEY');
      return res.status(500).json({ 
        success: false,
        error: 'OpenAI API 設定錯誤' 
      });
    }

    const base64Image = req.file.buffer.toString('base64');
    console.log('圖片轉換為 base64');

    // 獲取自定義問題
    const customQuestion = req.body.question || "這個東西多少錢？哪裡可以買到？";

    // 準備 prompt
    const prompt = `請分析這張圖片中的物品，並提供以下資訊：
1. 物品名稱
2. 預估價格範圍
3. 購買管道（實體店面和線上商城）
4. 物品描述
5. 歷史起源（如果適用）

請用中文回答，並保持專業客觀的語氣。`;

    console.log('開始呼叫 OpenAI API');
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });
    console.log('OpenAI API 回應成功');

    // 解析 AI 回應
    const analysis = response.choices[0].message.content;
    console.log('AI 回應:', analysis);
    
    // 將回應轉換為結構化數據
    const data = parseAnalysis(analysis);
    console.log('解析後的數據:', data);

    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('分析錯誤:', error);
    res.status(500).json({
      success: false,
      error: error.message || '分析失敗，請稍後再試'
    });
  }
});

// 解析 AI 回應
function parseAnalysis(text) {
  // 預設值
  const result = {
    name: '未知物品',
    price: '無法估計',
    priceNote: '價格可能因地區和通路而異',
    description: '無描述',
    availability: '無購買資訊',
    origin: '',
    purchaseLinks: {
      online: [
        { platform: '蝦皮購物', searchTerm: '' },
        { platform: 'PChome 24h', searchTerm: '' },
        { platform: 'momo購物網', searchTerm: '' }
      ]
    }
  };

  try {
    // 分析文本中的關鍵資訊
    const lines = text.split('\n');
    let currentSection = '';

    for (const line of lines) {
      if (line.includes('物品名稱')) {
        result.name = line.split('：')[1]?.trim() || result.name;
        result.purchaseLinks.online.forEach(link => {
          link.searchTerm = result.name;
        });
      }
      else if (line.includes('預估價格')) {
        result.price = line.split('：')[1]?.trim() || result.price;
      }
      else if (line.includes('購買管道')) {
        result.availability = line.split('：')[1]?.trim() || result.availability;
      }
      else if (line.includes('物品描述')) {
        result.description = line.split('：')[1]?.trim() || result.description;
      }
      else if (line.includes('歷史起源')) {
        result.origin = line.split('：')[1]?.trim() || result.origin;
      }
    }

  } catch (error) {
    console.error('解析錯誤:', error);
  }

  return result;
}

// 啟動服務器
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`服務器運行於 port ${port}`);
});
