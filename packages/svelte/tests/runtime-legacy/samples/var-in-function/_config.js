import { test } from '../../test';

export default test({
	html: '<button></button><p>0</p>',

	async test({ assert, target, window }) {
		const button = target.querySelector('button');
		const clickEvent = new window.MouseEvent('click', { bubbles: true });

		await button?.dispatchEvent(clickEvent);
		assert.htmlEqual(target.innerHTML, '<button></button><p>4</p>');
	}
});
