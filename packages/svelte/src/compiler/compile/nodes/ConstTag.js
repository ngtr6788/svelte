import Node from './shared/Node.js';
import Expression from './shared/Expression.js';
import { unpack_destructuring } from './shared/Context.js';
import { walk } from 'estree-walker';
import { extract_identifiers } from 'periscopic';
import is_reference from 'is-reference';
import get_object from '../utils/get_object.js';
import compiler_errors from '../compiler_errors.js';

const allowed_parents = new Set([
	'EachBlock',
	'CatchBlock',
	'ThenBlock',
	'InlineComponent',
	'SlotTemplate',
	'IfBlock',
	'ElseBlock'
]);

/** @extends Node<'ConstTag'> */
export default class ConstTag extends Node {
	/** @type {import('./shared/Expression.js').default} */
	expression;

	/** @type {import('./shared/Context.js').Context[]} */
	contexts = [];

	/** @type {import('../../interfaces.js').ConstTag} */
	node;

	/** @type {import('./shared/TemplateScope.js').default} */
	scope;

	/** @type {Map<string, import('estree').Node>} */
	context_rest_properties = new Map();

	/** @type {Set<string>} */
	assignees = new Set();

	/** @type {Set<string>} */
	dependencies = new Set();

	/**
	 * @param {import('../Component.js').default} component
	 * @param {import('./interfaces.js').INodeAllowConstTag} parent
	 * @param {import('./shared/TemplateScope.js').default} scope
	 * @param {import('../../interfaces.js').ConstTag} info
	 */
	constructor(component, parent, scope, info) {
		super(component, parent, scope, info);
		if (!allowed_parents.has(parent.type)) {
			component.error(info, compiler_errors.invalid_const_placement);
		}
		this.node = info;
		this.scope = scope;
		const { assignees, dependencies } = this;
		extract_identifiers(info.expression.left).forEach(
			/** @param {any}params_0 */ ({ name }) => {
				assignees.add(name);
				const owner = this.scope.get_owner(name);
				if (owner === parent) {
					component.error(info, compiler_errors.invalid_const_declaration(name));
				}
			}
		);
		walk(info.expression.right, {
			/**
			 * @param {any} node
			 * @param {any} parent
			 */
			enter(node, parent) {
				if (
					is_reference(
						/** @type {import('is-reference').NodeWithPropertyDefinition} */ (node),
						/** @type {import('is-reference').NodeWithPropertyDefinition} */ (parent)
					)
				) {
					const identifier = get_object(/** @type {any} */ (node));
					const { name } = identifier;
					dependencies.add(name);
				}
			}
		});
	}

	parse_expression() {
		const this_const_tag = this;
		this.expression = new Expression(this.component, this, this.scope, this.node.expression.right);
		const scope_proxy = new Proxy(this.scope, {
			get(target, prop, reciever) {
				if ('add' === prop) {
					/**
						* @param {string} name
						* @param {Set<string>} dependencies
						* @param {any} owner 
						*/
					return (name, dependencies, owner) => {
						const actual_owner = target.get_owner(name);
						if (actual_owner && actual_owner.type === 'ConstTag' && actual_owner.parent === this_const_tag.parent) {
							this_const_tag.component.error(
								this_const_tag.node,
								compiler_errors.invalid_const_declaration(name)
							);
						}
						target.add(name, dependencies, owner);
					}
				}

				return Reflect.get(target, prop, reciever);
			}
		});

		unpack_destructuring({
			contexts: this.contexts,
			owner: this,
			node: this.node.expression.left,
			scope: scope_proxy,
			component: this.component,
			dependencies: this.expression.dependencies,
			context_rest_properties: this.context_rest_properties
		});
	}
}
