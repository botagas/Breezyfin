import {render, screen} from '@testing-library/react';
import LoginCredentialsStep from '../LoginCredentialsStep';
import LoginQuickConnectStep from '../LoginQuickConnectStep';
import LoginSavedAccountsStep from '../LoginSavedAccountsStep';

jest.mock('@enact/sandstone/BodyText', () => function TestBodyText({children, ...props}) {
	return <div {...props}>{children}</div>;
});

jest.mock('../../../../components/BreezyLoadingOverlay', () => function TestLoading({label}) {
	return <div role="status">{label}</div>;
});

jest.mock('@enact/sandstone/Input', () => function TestInput({autoFocus, ...props}) {
	return <input data-autofocus={autoFocus ? 'true' : 'false'} {...props} />;
});

jest.mock('../../../../components/BreezyButton', () => function TestButton(props) {
	return (
		<button
			data-autofocus={props.autoFocus ? 'true' : 'false'}
			onClick={props.onClick}
			disabled={props.disabled}
			className={props.className}
		>
			{props.children}
		</button>
	);
});

const css = new Proxy({}, {get: (_target, key) => String(key)});

describe('Login steps', () => {
	it('marks the expired saved account for reauthentication', () => {
		render(
			<LoginSavedAccountsStep
				SavedItemComponent="button"
				savedServers={[{
					serverId: 'server-1',
					userId: 'user-1',
					username: 'Alice',
					serverName: 'Media'
				}]}
				resumingKey={null}
				reauthenticationKey="server-1:user-1"
				loading={false}
				getSavedUserAvatarUrl={() => null}
				onResumeClick={jest.fn()}
				onAddServer={jest.fn()}
				onAddUser={jest.fn()}
				onSavedAvatarError={jest.fn()}
				css={css}
			/>
		);
		expect(screen.getByText('Sign in again')).toBeTruthy();
	});

	it('focuses the password for reauthentication and keeps Quick Connect optional', () => {
		render(
			<LoginCredentialsStep
				serverUrl="http://media.local"
				username="Alice"
				password=""
				loading={false}
				focusPassword
				quickConnectAvailable
				onUsernameChange={jest.fn()}
				onUsernameKeyDown={jest.fn()}
				onPasswordChange={jest.fn()}
				onPasswordKeyDown={jest.fn()}
				onBack={jest.fn()}
				onLogin={jest.fn()}
				onQuickConnect={jest.fn()}
				css={css}
			/>
		);
		expect(screen.getByPlaceholderText('Password (optional)').getAttribute('data-autofocus')).toBe('true');
		expect(screen.getByText('Use Quick Connect')).toBeTruthy();
	});

	it('focuses Back while waiting and Retry after a failure', () => {
		const {rerender} = render(
			<LoginQuickConnectStep
				phase="waiting"
				code="ABC123"
				error=""
				onRetry={jest.fn()}
				onBack={jest.fn()}
				css={css}
			/>
		);
		expect(screen.getByText('Back').getAttribute('data-autofocus')).toBe('true');
		expect(screen.getByRole('status').textContent).toBe('Waiting for approval...');

		rerender(
			<LoginQuickConnectStep
				phase="failed"
				code="ABC123"
				error="Could not connect."
				onRetry={jest.fn()}
				onBack={jest.fn()}
				css={css}
			/>
		);
		expect(screen.getByText('Retry').getAttribute('data-autofocus')).toBe('true');
	});
});
