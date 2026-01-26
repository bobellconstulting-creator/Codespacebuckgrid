# BuckGrid Pro

Elite Whitetail Habitat Mapping application with AI-powered analysis.

## Features

### Frontend
- **Interactive Map**: Draw points, lines, and polygons on a satellite map
- **Drawing Tools**: Border, clover, brassicas, corn, soybeans, and more habitat features
- **Tony Chat Interface**: AI-powered habitat analysis assistant
- **Analyze Button**: Get AI insights on your property layout and management strategy

### Backend
- **`/api/chat`**: Chat with Tony about your property using vision AI (map screenshots)
- **`/api/analyze`**: Analyze your property plan with GeoJSON layers

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/bobellconstulting-creator/Codespacebuckgrid.git
cd Codespacebuckgrid
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Edit `.env.local` and add your OpenRouter API key:
```
OPENROUTER_API_KEY=your_api_key_here
```

Get your API key from: https://openrouter.ai/keys

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production

Build the application:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## Usage

1. **Draw Property Boundary**: Click "BORDER" tool and click points on the map to define your property boundary
2. **Lock Border**: Click "LOCK BORDER" to finalize your boundary and calculate acreage
3. **Add Features**: Use the various tools (CLOVER, CORN, STAND, etc.) to mark different areas
4. **Analyze**: Click the "🔍 ANALYZE PLAN" button to get AI-powered insights on your property layout
5. **Chat**: Type messages to Tony for specific questions or advice

## Technology Stack

- **Next.js 14.2.35**: React framework with App Router
- **React 18**: UI library
- **Leaflet**: Interactive mapping library
- **TypeScript**: Type-safe development
- **OpenRouter API**: AI-powered analysis using Claude 3.5 Sonnet
- **html2canvas**: Map screenshot capture for vision AI

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key for AI analysis | Yes |

**Note**: The API key is used server-side only and is never exposed to the client.

## API Endpoints

### POST /api/analyze
Analyzes property plan with GeoJSON layers.

**Request Body:**
```json
{
  "planJson": {
    "layers": [/* GeoJSON features */]
  }
}
```

**Response:**
```json
{
  "analysis": "AI-generated analysis text"
}
```

### POST /api/chat
Chat with Tony using map screenshots.

**Request Body:**
```json
{
  "message": "Your message",
  "imageDataUrl": "data:image/jpeg;base64,..."
}
```

**Response:**
```json
{
  "reply": "Tony's response"
}
```

## Security

- ✅ No authentication required (MVP)
- ✅ API keys stored server-side only
- ✅ No known security vulnerabilities (CodeQL verified)
- ✅ Updated to Next.js 14.2.35 (latest security patches)

## License

Private project.

## Support

For issues or questions, please open an issue in the GitHub repository.
