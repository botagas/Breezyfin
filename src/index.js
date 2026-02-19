/* global ENACT_PACK_ISOMORPHIC */
import {createRoot, hydrateRoot} from 'react-dom/client';

import './styles/themes/classic.css';
import './styles/themes/elegant.css';
import './global.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {initAppLogger} from './utils/appLogger';

const appElement = (<App />);

if (typeof window !== 'undefined') {
	initAppLogger();
	if (ENACT_PACK_ISOMORPHIC) {
		hydrateRoot(document.getElementById('root'), appElement);
	} else {
		createRoot(document.getElementById('root')).render(appElement);
	}
}

export default appElement;

reportWebVitals();
