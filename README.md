
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

## Folder Structure

```
Breezyfin/
  appinfo.json         # webOS app manifest
  package.json         # Project metadata and scripts
  src/
    App/               # Main app logic
    components/        # Reusable UI components
    services/          # API and backend services
    views/             # App panels and screens
    global.css         # Global styles
    index.js           # Entry point
    reportWebVitals.js # Performance reporting
  resources/           # Localization and assets
  tests/               # Test artifacts and tools
```

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

---
For more information, see the documentation in each folder and the [Enact CLI guide](https://github.com/enactjs/cli/blob/master/docs/index.md).

### `npm run pack` and `npm run pack-p`

Builds the project in the working directory. Specifically, `pack` builds in development mode with code un-minified and with debug code included, whereas `pack-p` builds in production mode, with everything minified and optimized for performance. Be sure to avoid shipping or performance testing on development mode builds.

### `npm run watch`

Builds the project in development mode and keeps watch over the project directory. Whenever files are changed, added, or deleted, the project will automatically get rebuilt using an active shared cache to speed up the process. This is similar to the `serve` task, but without the http server.

### `npm run clean`

Deletes previous build fragments from ./dist.

### `npm run lint`

Runs the Enact configuration of Eslint on the project for syntax analysis.

### `npm run test` and `npm run test-watch`

These tasks will execute all valid tests (files that end in `-specs.js`) that are within the project directory. The `test` is a standard single execution pass, while `test-watch` will set up a watcher to re-execute tests when files change.

## Enact Build Options

The @enact/cli tool will check the project's `package.json` looking for an optional `enact` object for a few customization options:

* `template` _[string]_ - Filepath to an alternate HTML template to use with the [Webpack html-webpack-plugin](https://github.com/jantimon/html-webpack-plugin).
* `isomorphic` _[string]_ - Alternate filepath to a custom isomorphic-compatible entry point. Not needed if main entry point is already isomorphic-compatible.
* `title` _[string]_ - Title text that should be put within the HTML's `<title></title>` tags. Note: if this is a webOS-project, the title will, by default, be auto-detected from the **appinfo.json** content.
* `theme` _[object]_ - A simplified string name to extrapolate `fontGenerator`, `ri`, and `screenTypes` preset values from. For example, `"sandstone"`.
* `fontGenerator` _[string]_ - Filepath to a CommonJS fontGenerator module which will build locale-specific font CSS to inject into the HTML. By default, will use any preset for a specified theme or fallback to sandstone.
* `ri` _[object]_ - Resolution independence options to be forwarded to the [postcss-resolution-independence](https://github.com/enactjs/postcss-resolution-independence). By default, will use any preset for a specified theme or fallback to sandstone.
  * `baseSize` _[number]_ - The root font-size to use when converting the value of the base unit to a resolution-independent unit. For example, when `baseSize` is set to 24, 48px in the LESS file will be converted to 2rem.
* `screenTypes` _[array|string]_ - Array of 1 or more screentype definitions to be used with prerender HTML initialization. Can alternatively reference a json filepath to read for screentype definitions.  By default, will use any preset for a specified theme or fallback to sandstone.
* `nodeBuiltins` _[object]_ - Configuration settings for polyfilling NodeJS built-ins. See `node` [webpack option](https://webpack.js.org/configuration/node/).
* `resolveFallback` _[object]_ - Configuration settings for redirecting module requests when normal resolving fails. See `resolve.fallback` [webpack option](https://webpack.js.org/configuration/resolve/#resolvefallback).
* `deep` _[string|array]_ - 1 or more JavaScript conditions that, when met, indicate deeplinking and any prerender should be discarded.
* `target` _[string|array]_ - A build-type generic preset string (see `target` [webpack option](https://webpack.js.org/configuration/target/)) or alternatively a specific [browserslist array](https://github.com/browserslist/browserslist) of desired targets.
* `proxy` _[string]_ - Proxy target during project `serve` to be used within the [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware).

For example:
```js
{
  ...
  "enact": {
    "theme": "sandstone",
    "resolveFallback": {
      fs: false,
      net: false,
      tls: false
    }
  }
  ...
}
```

## Displaying Lint Output in the Editor

Some editors, including Sublime Text, Atom, and Visual Studio Code, provide plugins for ESLint.

They are not required for linting. You should see the linter output right in your terminal as well as the browser console. However, if you prefer the lint results to appear right in your editor, there are some extra steps you can do.

You would need to install an ESLint plugin for your editor first.

Ever since ESLint 6, global installs of ESLint configs are no longer supported.
To work around this new limitation, while still supporting in-editor linting, we've created a new [eslint-config-enact-proxy](https://github.com/enactjs/eslint-config-enact-proxy) package.
The [eslint-config-enact-proxy](https://github.com/enactjs/eslint-config-enact-proxy) acts like a small proxy config, redirecting ESLint to use a globally-installed Enact ESLint config.
`eslint-config-enact-proxy` needs to be installed locally on a project to enable in-editor linting:

```sh
npm install --save-dev eslint-config-enact-proxy
```

Also, you need to modify `eslintConfig` property in `package.json`:

```json
  "eslintConfig": {
    "extends": "enact-proxy"
  },
```
>**NOTE**: For strict mode, use `"extends": "enact-proxy/strict"`.

In order for in-editor linting to work with our updated ESLint config, you'll need to upgrade to ESLint 7 or later. This can be installed globally by running:

```sh
npm install -g eslint
```

Then, you will need to uninstall any previous globally-installed Enact linting package (everything but eslint itself):

```sh
npm uninstall -g eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-babel @babel/eslint-parser eslint-plugin-jest eslint-plugin-enact eslint-config-enact
```

## Installing a Dependency

The generated project includes Enact (and all its libraries). It also includes React and ReactDOM.  For test writing, both Jest and @testing-library/react are as development dependencies. You may install other dependencies with `npm`:

```sh
npm install --save <package-name>
```

## Importing a Component

This project setup supports ES6 modules thanks to Babel.
While you can still use `require()` and `module.exports`, we encourage you to use [`import` and `export`](http://exploringjs.com/es6/ch_modules.html) instead.

For example:

### `Button.js`

```js
import kind from '@enact/core/kind';

const Button = kind({
  render() {
    // ...
  }
});

export default Button; // Don’t forget to use export default!
```

### `DangerButton.js`


```js
import kind from '@enact/core/kind';
import Button from './Button'; // Import a component from another file

const DangerButton = kind({
  render(props) {
    return <Button {...props} color="red" />;
  }
});

export default DangerButton;
```

Be aware of the [difference between default and named exports](http://stackoverflow.com/questions/36795819/react-native-es-6-when-should-i-use-curly-braces-for-import/36796281#36796281). It is a common source of mistakes.

We suggest that you stick to using default imports and exports when a module only exports a single thing (for example, a component). That’s what you get when you use `export default Button` and `import Button from './Button'`.

Named exports are useful for utility modules that export several functions. A module may have at most one default export and as many named exports as you like.

Learn more about ES6 modules:

* [When to use the curly braces?](http://stackoverflow.com/questions/36795819/react-native-es-6-when-should-i-use-curly-braces-for-import/36796281#36796281)
* [Exploring ES6: Modules](http://exploringjs.com/es6/ch_modules.html)
* [Understanding ES6: Modules](https://leanpub.com/understandinges6/read#leanpub-auto-encapsulating-code-with-modules)

## Adding a LESS or CSS Stylesheet

This project setup uses [Webpack](https://webpack.github.io/) for handling all assets. Webpack offers a custom way of “extending” the concept of `import` beyond JavaScript. To express that a JavaScript file depends on a LESS/CSS file, you need to **import the CSS from the JavaScript file**:

### `Button.less`

```css
.button {
  padding: 20px;
}
```

### `Button.js`

```js
import kind from '@enact/core/kind';
import styles './Button.css'; // Tell Webpack that Button.js uses these styles

const Button = kind({
  render() {
    // You can use them as regular CSS styles
    return <div className={styles['button']} />;
  }
}
```

Upon importing a css/less files, the resulting object will be a mapping of class names from that document. This allows correct access to the class name string regardless how the build process mangles it up.

In development, expressing dependencies this way allows your styles to be reloaded on the fly as you edit them. In production, all CSS files will be concatenated into a single minified `.css` file in the build output.

Additionally, this system setup supports [CSS module spec](https://github.com/css-modules/css-modules) with allows for compositional CSS classes and inheritance of styles.

## Adding Images and Custom Fonts

With Webpack, using static assets like images and fonts works similarly to CSS.

You can **`import` an image right in a JavaScript module**. This tells Webpack to include that image in the bundle. Unlike CSS imports, importing an image or a font gives you a string value. This value is the final image path you can reference in your code.

Here is an example:

```js
import kind from '@enact/core/kind';
import logo from './logo.png'; // Tell Webpack this JS file uses this image

console.log(logo); // /logo.84287d09.png

const Header = kind({
  render: function() {
    // Import result is the URL of your image
    return <img src={logo} alt="Logo" />;
  }
});

export default Header;
```

This is currently required for local images. This ensures that when the project is built, webpack will correctly move the images into the build folder, and provide us with correct paths.

This works in LESS/CSS too:

```css
.logo {
  background-image: url(./logo.png);
}
```

Webpack finds all relative module references in CSS (they start with `./`) and replaces them with the final paths from the compiled bundle. If you make a typo or accidentally delete an important file, you will see a compilation error, just like when you import a non-existent JavaScript module. The final filenames in the compiled bundle are generated by Webpack from content hashes.
