import Button from '../components/BreezyButton';
import kind from '@enact/core/kind';
import {Panel, Header} from '../components/BreezyPanels';

const MainPanel = kind({
	name: 'MainPanel',

	render: (props) => (
		<Panel {...props}>
			<Header title="Hello world!" />
			<Button>Click me</Button>
		</Panel>
	)
});

export default MainPanel;
