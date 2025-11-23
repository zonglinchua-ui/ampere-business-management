# Using Local Ollama for Document Processing

This guide explains how to configure the system to use your local Ollama instance instead of cloud-based LLM providers.

## Prerequisites

1. **Ollama installed** on your web server PC
2. **A suitable model** downloaded (recommended: `llama3.1:8b` or better)

## Step 1: Install and Setup Ollama

If you haven't already installed Ollama, download it from [ollama.ai](https://ollama.ai)

### Download a Model

For document processing, we recommend these models:

```bash
# Recommended: Good balance of speed and accuracy
ollama pull llama3.1:8b

# Better accuracy (requires more RAM/VRAM)
ollama pull llama3.1:70b

# Faster but less accurate
ollama pull mistral:7b

# Good for document understanding
ollama pull qwen2.5:14b
```

### Verify Ollama is Running

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Test the model
ollama run llama3.1:8b "Hello, can you help me extract data from documents?"
```

## Step 2: Configure Environment Variables

Add these variables to your `.env` file:

```env
# Use Ollama as the LLM provider
LLM_PROVIDER=ollama

# Ollama server URL (default is localhost)
OLLAMA_BASE_URL=http://localhost:11434

# Model to use for document processing
OLLAMA_MODEL=llama3.1:8b
```

## Step 3: Restart Your Application

```bash
# If using PM2
pm2 restart ampere

# If running manually
yarn build
yarn start
```

## Step 4: Test Document Processing

1. Go to the AI Assistant page in your application
2. Upload a test document (PO, Invoice, or Progress Claim)
3. Click "Process with AI"
4. Check the server logs to see Ollama processing the document

## Troubleshooting

### Error: "Connection refused to localhost:11434"

**Solution:** Make sure Ollama is running:
```bash
# Windows
ollama serve

# Check if it's running
netstat -an | findstr 11434
```

### Error: "Model not found"

**Solution:** Download the model first:
```bash
ollama pull llama3.1:8b
```

### Slow Processing

**Solutions:**
1. Use a smaller model (e.g., `mistral:7b`)
2. Ensure Ollama has access to GPU (check with `ollama ps`)
3. Increase system resources allocated to Ollama

### Poor Extraction Quality

**Solutions:**
1. Use a larger/better model (e.g., `llama3.1:70b` or `qwen2.5:14b`)
2. Ensure documents are clear and well-formatted
3. Try processing text-based documents (DOCX, TXT) instead of scanned PDFs

## Performance Comparison

| Model | Speed | Accuracy | RAM Required |
|-------|-------|----------|--------------|
| mistral:7b | Fast | Good | 8 GB |
| llama3.1:8b | Medium | Very Good | 8 GB |
| qwen2.5:14b | Medium | Excellent | 16 GB |
| llama3.1:70b | Slow | Excellent | 48 GB |

## Switching Back to Cloud Providers

To switch back to AbacusAI or OpenAI, update your `.env`:

```env
# For AbacusAI
LLM_PROVIDER=abacusai
ABACUSAI_API_KEY=your_key_here

# For OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key_here
```

## Notes

- **PDF Processing:** Currently, Ollama only processes text content from PDFs. For scanned PDFs, consider using OCR first.
- **Image Processing:** Image-based document analysis requires vision models (coming soon).
- **Privacy:** Using local Ollama means your documents never leave your server.
- **Cost:** Local processing is free but requires adequate hardware resources.
