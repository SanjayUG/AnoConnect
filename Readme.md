# AnoConnect

AnoConnect is a simple Node.js web application that provides anonymous connectivity through a basic web interface. The project includes a server, a public-facing HTML page, and supporting CSS and JavaScript files.

## Features
- Node.js server (`server.js`)
- Static file serving (HTML, CSS, JS)
- Simple web UI (`public/index.html`)
- Custom styles (`public/styles.css`)
- Client-side logic (`public/app.js`)

## Getting Started

### Prerequisites
- Node.js (v14 or higher recommended)

### Installation
1. Clone the repository:
   ```powershell
   git clone <repo-url>
   cd AnoConnect
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```

### Running the Application
Start the server:
```powershell
node server.js
```
Open your browser and navigate to `http://localhost:3000` (or the port specified in `server.js`).

## Project Structure
```
AnoConnect/
├── package.json
├── Readme.md
├── server.js
└── public/
    ├── app.js
    ├── index.html
    └── styles.css
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
This project is licensed under the MIT License.
