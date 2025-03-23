# Montonio to Merit Aktiva Middleware

A Node.js middleware that automatically synchronizes sales data from Montonio.ee to Merit Aktiva.

## Features

- Automatic synchronization of sales data from Montonio to Merit Aktiva
- Scheduled sync jobs
- API endpoint for manual synchronization
- Detailed logging
- Error handling and retry mechanisms

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on the provided example

## Configuration

Copy the `.env.example` file to `.env` and fill in your API credentials:

```
# Montonio API Configuration
MONTONIO_API_URL=https://api.montonio.com
MONTONIO_API_KEY=your_montonio_api_key

# Merit Aktiva API Configuration
MERIT_API_URL=https://api.merit.ee
MERIT_API_KEY=your_merit_api_key
```

## Usage

### Development

```
npm run dev
```

### Production

```
npm start
```

### Testing

```
npm test
```

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /sync` - Trigger manual synchronization (requires API key in header `x-api-key`)

## License

MIT
# ussimo-server
