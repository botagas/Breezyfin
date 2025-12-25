
# Breezyfin for webOS

Breezyfin is a Jellyfin client for LG webOS TVs, built with Enact Sandstone. It provides a fast, modern interface for browsing, searching, and streaming your Jellyfin media library.

## Features

- Login to your Jellyfin server
- Browse libraries and media
- Search and filter content
- Favorites and recently played
- Media playback with HLS support
- Settings and customization

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation

Clone the repository and install dependencies:

```sh
git clone https://github.com/your-org/breezyfin-webos.git
cd breezyfin-webos/Breezyfin
npm install
```

### Development

Start the development server:

```sh
npm run serve
```
Visit [http://localhost:8080](http://localhost:8080) in your browser.

### Build for Production

```sh
npm run pack-p
```
Output will be in the `dist/` folder.

### Packaging for webOS

Use the webOS SDK or CLI tools to package the app for deployment to your TV. See [webOS documentation](https://webostv.developer.lge.com/) for details.

## Scripts

- `npm run serve` — Start development server
- `npm run pack` — Build in development mode
- `npm run pack-p` — Build in production mode
- `npm run watch` — Watch files and rebuild on changes
- `npm run clean` — Remove build artifacts
- `npm run lint` — Run ESLint
- `npm run test` — Run tests

## Permissions

The app requests the following webOS permissions (see `appinfo.json`):

- `time.query`
- `activity.operation`
- `network.operation`
- `media.operation`

## Contributing

Pull requests and issues are welcome! Please follow the code style and add tests for new features. See the [components/README.md](src/components/README.md) for reusable UI guidelines.

## License

This project is currently **UNLICENSED**. Please update the license in `package.json` if you intend to distribute or modify.

## Credits

- Built with [Enact Sandstone](https://github.com/enactjs/sandstone)
- Uses [Jellyfin SDK](https://github.com/jellyfin/sdk)
- BEWARE: AI was used when developing this app. This means that it may have vulnerabilities, dead-code, and functional issues that could be addressed in the future.