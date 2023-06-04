import { b } from 'code-red';
import Expression from '../../../nodes/shared/Expression.js';

/**
 * @param {import('../../Block.js').default} block
 * @param {import('../../../nodes/ConstTag.js').default[]} const_tags
 * @param {string} ctx
 */
export function add_const_tags(block, const_tags, ctx) {
	const const_tags_props = [];
	const_tags.forEach((const_tag, i) => {
		const name = `#constants_${i}`;
		const_tags_props.push(b`const ${name} = ${const_tag.expression.manipulate(block, ctx)}`);

		const_tag.contexts.forEach((context) => {
			if (context.type === 'DestructuredVariable') {
				const_tags_props.push(
					b`${ctx}[${
						block.renderer.context_lookup.get(context.key.name).index
					}] = ${context.default_modifier({ type: 'Identifier', name })}`
				);
			} else if (context.type === 'ComputedProperty') {
				const expression = new Expression(
					block.renderer.component,
					const_tag,
					const_tag.scope,
					context.key
				);
				const_tags_props.push(
					b`const ${context.property_name} = ${expression.manipulate(block, ctx)}`
				);
			} else {
				const expression = new Expression(
					block.renderer.component,
					const_tag,
					const_tag.scope,
					context.key
				);
				const_tags_props.push(
					b`const ${context.value_name} = ${expression.manipulate(block, ctx)}`
				);
			}
		});
	});
	return const_tags_props;
}

/**
 * @param {import('../../Renderer.js').default} renderer
 * @param {import('../../../nodes/ConstTag.js').default[]} const_tags
 */
export function add_const_tags_context(renderer, const_tags) {
	const_tags.forEach((const_tag) => {
		const_tag.contexts.forEach((context) => {
			if (context.type !== 'DestructuredVariable') return;
			renderer.add_to_context(context.key.name, true);
		});
	});
}
