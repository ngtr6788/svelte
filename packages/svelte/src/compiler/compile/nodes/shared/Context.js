import { x } from 'code-red';
import { walk } from 'estree-walker';
import is_reference from 'is-reference';
import flatten_reference from '../../utils/flatten_reference.js';
/**
 * @param {{
 * 	contexts: Context[];
 * 	node: import('estree').Pattern;
 * 	modifier?: DestructuredVariable['modifier'];
 * 	default_modifier?: DestructuredVariable['default_modifier'];
 * 	scope: import('./TemplateScope.js').default;
 * 	component: import('../../Component.js').default;
 * 	context_rest_properties: Map<string, import('estree').Node>;
 * 	in_rest_element?: boolean;
 * }} params
 */
export function unpack_destructuring({
	contexts,
	node,
	modifier = (node) => node,
	default_modifier = (node) => node,
	scope,
	component,
	context_rest_properties,
	in_rest_element = false
}) {
	if (!node) return;
	if (node.type === 'Identifier') {
		contexts.push({
			type: 'DestructuredVariable',
			key: /** @type {import('estree').Identifier} */ (node),
			modifier,
			default_modifier
		});
		if (in_rest_element) {
			context_rest_properties.set(node.name, node);
		}
	} else if (node.type === 'AssignmentPattern') {
		// e.g. { property = default } or { property: newName = default }
		const n = contexts.length;
		mark_referenced(node.right, scope, component);

		const value_name = component.get_unique_name('default_value');
		contexts.push({
			type: 'DefaultValue',
			value_name,
			key: node.right
		});

		/** @type {(xnode: import('estree').Node) => import('estree').Node} */
		const new_default_modifier = (xnode) => {
			check_initialization(contexts, n, node.right);
			const member_expr = default_modifier(xnode);
			return x`${member_expr} !== undefined ? ${member_expr} : ${value_name}`;
		};

		const new_node = node.left;

		unpack_destructuring({
			contexts,
			node: new_node,
			modifier,
			default_modifier: new_default_modifier,
			scope,
			component,
			context_rest_properties,
			in_rest_element
		});
	} else if (node.type === 'ArrayPattern') {
		node.elements.forEach((element, i) => {
			if (!element) {
				return;
			} 
			
			/** @type {(node: import('estree').Node) => import('estree').Node} */
			let property_modifier;

			/** @type {import('estree').Pattern} */
			let new_node;

			if (element.type === 'RestElement') {
				property_modifier = (node) => x`${node}.slice(${i})`;
				new_node = element.argument;
				in_rest_element = true;
			} else {
				property_modifier = (node) => x`${node}[${i}]`;
				new_node = element;
			}

			/** @param {import('estree').Node} node */
			const new_modifier = (node) => property_modifier(modifier(node));

			/** @param {import('estree').Node} node */
			const new_default_modifier = (node) => property_modifier(default_modifier(node));

			unpack_destructuring({
				contexts,
				node: new_node,
				modifier: new_modifier,
				default_modifier: new_default_modifier,
				scope,
				component,
				context_rest_properties,
				in_rest_element
			});
		});
	} else if (node.type === 'ObjectPattern') {
		const used_properties = [];
		node.properties.forEach((property) => {
			/** @type {(node: import('estree').Node) => import('estree').Node} */
			let property_modifier;

			/** @type {import('estree').Pattern} */
			let new_node;

			if (property.type === 'RestElement') {
				property_modifier = (node) =>	x`@object_without_properties(${node}, [${used_properties}])`;
				new_node = property.argument;
				in_rest_element = true;
			} else if (property.type === 'Property') {
				const key = property.key;

				if (property.computed) {
					// e.g { [computedProperty]: ... }
					const property_name = component.get_unique_name('computed_property');
					contexts.push({
						type: 'ComputedProperty',
						property_name,
						key
					});
					property_modifier = (node) => x`${node}[${property_name}]`;
					used_properties.push(x`${property_name}`);
				} else if (key.type === 'Identifier') {
					// e.g. { someProperty: ... }
					const property_name = key.name;
					property_modifier = (node) => x`${node}.${property_name}`;
					used_properties.push(x`"${property_name}"`);
				} else if (key.type === 'Literal') {
					// e.g. { "property-in-quotes": ... } or { 14: ... }
					const property_name = key.value;
					used_properties.push(x`"${property_name}"`);
					property_modifier = (node) => x`${node}["${property_name}"]`;
				}

				new_node = property.value;
			}

			/** @param {import('estree').Node} node */
			const new_modifier = (node) => property_modifier(modifier(node));
			/** @param {import('estree').Node} node */
			const new_default_modifier = (node) => property_modifier(default_modifier(node));

			unpack_destructuring({
				contexts,
				node: new_node,
				modifier: new_modifier,
				default_modifier: new_default_modifier,
				scope,
				component,
				context_rest_properties,
				in_rest_element
			});
		});
	}
}

/**
 * @param {Context[]} contexts
 * @param {number} n
 * @param {import('estree').Expression} expression
 */
function check_initialization(contexts, n, expression) {
	/** @param {import('estree').Identifier} node */
	const find_from_context = (node) => {
		for (let i = n; i < contexts.length; i++) {
			const cur_context = contexts[i];
			if (cur_context.type !== 'DestructuredVariable') continue;
			const { key } = cur_context;
			if (node.name === key.name) {
				throw new Error(`Cannot access '${node.name}' before initialization`);
			}
		}
	};
	if (expression.type === 'Identifier') {
		return find_from_context(expression);
	}
	walk(expression, {
		enter(node, parent) {
			if (is_reference(node, parent)) {
				find_from_context(/** @type {import('estree').Identifier} */ (node));
				this.skip();
			}
		}
	});
	return expression;
}

/**
 * @param {import('estree').Node} node
 * @param {import('./TemplateScope.js').default} scope
 * @param {import('../../Component.js').default} component
 */
function mark_referenced(node, scope, component) {
	walk(node, {
		enter(node, parent) {
			if (is_reference(node, parent)) {
				const { name } = flatten_reference(node);
				if (!scope.is_let(name) && !scope.names.has(name)) {
					component.add_reference(node, name);
				}
			}
		}
	});
}

/** @typedef {DestructuredVariable | ComputedProperty | DefaultValue} Context */

/**
	* @typedef {Object} DefaultValue
	* @property {'DefaultValue'} type
	* @property {import('estree').Identifier} value_name
	* @property {import('estree').Expression} key
	*/

/**
 * @typedef {Object} ComputedProperty
 * @property {'ComputedProperty'} type
 * @property {import('estree').Identifier} property_name
 * @property {import('estree').Expression|import('estree').PrivateIdentifier} key
 */

/**
 * @typedef {Object} DestructuredVariable
 * @property {'DestructuredVariable'} type
 * @property {import('estree').Identifier} key
 * @property {string} [name]
 * @property {(node:import('estree').Node)=>import('estree').Node} modifier
 * @property {(node:import('estree').Node)=>import('estree').Node} default_modifier
 */
