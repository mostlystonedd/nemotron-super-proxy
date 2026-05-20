// server.js - Nemotron Super 49B Proxy for Janitor AI
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const NIM_API_BASE = 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NIM_API_KEY;
const PRIMARY_MODEL = 'nvidia/llama-3.3-nemotron-super-49b-v1.5';

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    model: PRIMARY_MODEL,
    ready: !!NIM_API_KEY
  });
});

// Root info
app.get('/', (req, res) => {
  res.json({
    name: 'Nemotron Super 49B Proxy',
    model: PRIMARY_MODEL,
    status: 'running',
    endpoints: ['/health', '/v1/models', '/v1/chat/completions']
  });
});

// List models
app.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: [
      { id: 'gpt-4o', object: 'model', owned_by: 'nemotron-proxy' },
      { id: 'gpt-4', object: 'model', owned_by: 'nemotron-proxy' },
      { id: 'nemotron', object: 'model', owned_by: 'nemotron-proxy' }
    ]
  });
});

// Chat endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages, temperature, max_tokens, stream } = req.body;
    
    if (!NIM_API_KEY) {
      return res.status(500).json({ error: { message: 'API key not configured' }});
    }
    
    const nimRequest = {
      model: PRIMARY_MODEL,
      messages: messages,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 8192,
      stream: stream || false
    };
    
    const response = await axios.post(`${NIM_API_BASE}/chat/completions`, nimRequest, {
      headers: {
        'Authorization': `Bearer ${NIM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: stream ? 'stream' : 'json',
      timeout: 120000
    });
    
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      response.data.pipe(res);
      
    } else {
      const openaiResponse = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-4o',
        choices: response.data.choices.map(choice => ({
          index: choice.index,
          message: {
            role: choice.message.role,
            content: choice.message.content || ''
          },
          finish_reason: choice.finish_reason
        })),
        usage: response.data.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
      
      res.json(openaiResponse);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    res.status(error.response?.status || 500).json({
      error: {
        message: error.message || 'Server error',
        type: 'api_error'
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Nemotron Super 49B running on port ${PORT}`);
});
