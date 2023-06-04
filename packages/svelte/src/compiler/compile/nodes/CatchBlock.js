import AbstractBlock from './shared/AbstractBlock.js';
import get_const_tags from './shared/get_const_tags.js';
import { unpack_destructuring } from './shared/Context.js';

/** @extends AbstractBlock<'CatchBlock'> */
export default class CatchBlock extends AbstractBlock {
	/** @type {import('./shared/TemplateScope.js').default} */
	scope;

	/** @type {import('./ConstTag.js').default[]} */
	const_tags;

	/**
	 * @param {import('../Component.js').default} component
	 * @param {import('./AwaitBlock.js').default} parent
	 * @param {import('./shared/TemplateScope.js').default} scope
	 * @param {import('../../interfaces.js').TemplateNode} info
	 */
	constructor(component, parent, scope, info) {
		super(component, parent, scope, info);
		this.scope = scope.child();
		if (parent.catch_node) {
			unpack_destructuring({
				contexts: parent.catch_contexts,
				owner: this,
				node: parent.catch_node,
				scope: this.scope,
				component,
				dependencies: parent.expression.dependencies,
				context_rest_properties: parent.context_rest_properties
			});
		}
		[this.const_tags, this.children] = get_const_tags(info.children, component, this, parent);
		if (!info.skip) {
			this.warn_if_empty_block();
		}
	}
}
