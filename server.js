const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');

const app = express();
const upload = multer({ 
  limits: { fileSize: 10 * 1024 * 1024 },
  storage: multer.memoryStorage()
});

// CORS 設定
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://lynn800741.github.io'
  ]
}));

app.use(express.json());

// 初始化 OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 健康檢查
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '萬物價格掃描器 API 運行中',
    endpoints: {
      health: '/api/health',
      analyze: '/api/analyze (POST)'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'GPT-4o 價格掃描器 API' });
});

// 主要的圖片分析端點
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '請提供圖片' });
    }

    const base64Image = req.file.buffer.toString('base64');

    // 獲取自定義問題
    const customQuestion = req.body.question || "這個東西多少錢？哪裡可以買到？";

    // 萬物價格掃描提示詞
    const prompt = `你是萬物價格評估專家，任何東西都能給出價格！

核心原則：
1. 萬物皆有價格 - 從一支筆到整個太陽
2. 無法購買的東西用創意方式計算價值
3. 保持專業但帶幽默感
4. 絕對禁止說「無價」或「無法估價」

分析步驟：
1. 詳細描述看到的物品（包含所有細節）
2. 識別具體是什麼（品牌、型號、種類等）
3. 給出合理或創意的價格

特殊物品定價原則：
- 太陽/月亮/星球：用科學方式計算（如能源價值、稀有元素）
- 建築物：估算建造成本+地價
- 動物：強調生命無價但給出飼養成本
- 人：幽默回應並計算「培養成本」
- 藝術品/古董：根據市場行情
- 大自然景觀：用觀光價值或保護成本計算

如果是商品：
- 識別具體品牌和型號
- 不要只說「玩具」「家電」這種模糊分類
- 根據特徵推測最可能的產品

回應必須是JSON格式：
{
  "name": "具體名稱（如：野獸國 D-Stage 死侍雕像、太陽、台北101大樓）",
  "price": "NT$ 具體金額或範圍",
  "priceNote": "價格說明（如何計算或為何是這個價格）",
  "description": "詳細描述所有看到的特徵",
  "origin": "物品的歷史、背景或有趣知識",
  "material": "材質或組成",
  "usage": "用途或功能",
  "category": "分類",
  "brand": "品牌（如果有）",
  "size": "尺寸或規模",
  "weight": "重量或質量",
  "warranty": "保固或壽命",
  "availability": "哪裡可以買到或如何獲得",
  "popularityScore": 1-100,
  "ecoScore": 1-100,
  "durability": "耐用度或存在時間",
  "maintenance": "保養或維護方式",
  "tips": [
    "購買或獲得建議1",
    "購買或獲得建議2",
    "購買或獲得建議3"
  ],
  "relatedItems": [
    {"icon": "🔗", "name": "相關物品1"},
    {"icon": "🔍", "name": "相關物品2"},
    {"icon": "💡", "name": "相關物品3"}
  ],
  "purchaseLinks": {
    "online": [
      {"platform": "蝦皮購物", "searchTerm": "具體搜尋關鍵字"},
      {"platform": "PChome 24h", "searchTerm": "具體搜尋關鍵字"},
      {"platform": "momo購物網", "searchTerm": "具體搜尋關鍵字"},
      {"platform": "露天拍賣", "searchTerm": "具體搜尋關鍵字"},
      {"platform": "Yahoo拍賣", "searchTerm": "具體搜尋關鍵字"}
    ],
    "offline": [
      "實體店面或地點1",
      "實體店面或地點2"
    ]
  }
}

記住：要像偵探一樣分析每個細節，給出最準確的識別結果！
使用繁體中文回應。`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high"  // 高解析度分析每個細節
              }
            }
          ]
        }
      ],
      max_tokens: 2000,  // 增加到2000以容納更詳細的分析
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('分析錯誤:', error);
    res.status(500).json({ 
      success: false,
      error: '分析失敗，請稍後再試'
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`伺服器運行在 port ${PORT}`);
});
