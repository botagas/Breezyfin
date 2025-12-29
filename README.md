<p align="center">
<img src="./images/Breezyfin_main.png">
</p>

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

### Testing

Watch out for any new releases in this repository. 
Releases typically contain a ready-to-use IPK file.
- Download the IPK file from releases.
- Use WebOS Dev Manager (or a different tool of your choice) to install the app on the TV

### Development

Clone the repository and install dependencies:

```sh
git clone https://github.com/your-org/breezyfin-webos.git
cd breezyfin-webos/Breezyfin
npm install
```

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

## Contributing

Pull requests and issues are welcome! Please follow the code style and add tests for new features. See the [components/README.md](src/components/README.md) for reusable UI guidelines.

## Credits

- Built with [Enact Sandstone](https://github.com/enactjs/sandstone)
- Uses [Jellyfin SDK](https://github.com/jellyfin/sdk)
- **BEWARE**: AI was used when developing this app. This means that it may have vulnerabilities, dead-code, and functional issues that could be addressed in the future. It is currently in the **BAREBONES** stage.