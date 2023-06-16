<script>
	export let people;
</script>

{#each people as { ['name']: { ['fir' + 'st']: f, [true ? 'last' : 'lol']: l } } }
	<input bind:value={f}>
	<input bind:value={l}>
	<p>{f} {l}</p>
{/each}
