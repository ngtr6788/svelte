import { x } from 'code-red';
import Expression from './Expression.js';
/**
 * @param {{
 * 	contexts: Context[];
 * 	owner: import('../interfaces.js').INode;
 * 	node: import('estree').Pattern;
 * 	scope: import('./TemplateScope.js').default;
 * 	component: import('../../Component.js').default;
 * 	dependencies: Set<string>;
 * 	context_rest_properties: Map<string, import('estree').Node>;
 * 	modifier?: DestructuredVariable['modifier'];
 * 	default_modifier?: DestructuredVariable['default_modifier'];
 * 	in_rest_element?: boolean;
 * }} params
 */
export function unpack_destructuring({
	contexts,
	owner,
	node,
	scope,
	component,
	dependencies,
	context_rest_properties,
	modifier = (node) => node,
	default_modifier = (node) => node,
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
		scope.add(node.name, dependencies, owner);
	} else if (node.type === 'AssignmentPattern') {
		// e.g. { property = default } or { property: newName = default }
		const value_name = component.get_unique_name('default_value');
		contexts.push({
			type: 'DefaultValue',
			name: value_name,
			expression: new Expression(component, owner, scope, node.right)
		});

		/** @type {(xnode: import('estree').Node) => import('estree').Node} */
		const new_default_modifier = (xnode) => {
			const member_expr = default_modifier(xnode);
			return x`${member_expr} !== undefined ? ${member_expr} : ${value_name}`;
		};

		const new_node = node.left;

		unpack_destructuring({
			contexts,
			owner,
			node: new_node,
			scope,
			component,
			dependencies,
			context_rest_properties,
			modifier,
			default_modifier: new_default_modifier,
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
				owner,
				node: new_node,
				scope,
				component,
				dependencies,
				context_rest_properties,
				modifier: new_modifier,
				default_modifier: new_default_modifier,
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
						name: property_name,
						expression: new Expression(component, owner, scope, key)
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
				owner,
				node: new_node,
				scope,
				component,
				dependencies,
				context_rest_properties,
				modifier: new_modifier,
				default_modifier: new_default_modifier,
				in_rest_element
			});
		});
	}
}

/** @typedef {DestructuredVariable | ComputedProperty | DefaultValue} Context */

/**
	* @typedef {Object} DefaultValue
	* @property {'DefaultValue'} type
	* @property {import('estree').Identifier} name
	* @property {import('./Expression.js').default} expression
	*/

/**
 * @typedef {Object} ComputedProperty
 * @property {'ComputedProperty'} type
 * @property {import('estree').Identifier} name
 * @property {import('./Expression.js').default} expression
 */

/**
 * @typedef {Object} DestructuredVariable
 * @property {'DestructuredVariable'} type
 * @property {import('estree').Identifier} key
 * @property {string} [name]
 * @property {(node:import('estree').Node)=>import('estree').Node} modifier
 * @property {(node:import('estree').Node)=>import('estree').Node} default_modifier
 */
