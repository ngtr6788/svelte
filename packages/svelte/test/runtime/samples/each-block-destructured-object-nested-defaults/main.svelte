<script>
	export let objectsArray;
</script>

{#each objectsArray as { a: { b } = { b : 5 }, c: [d, [e, f] = [7, 8]] = [6] } }
  <p>b: {b}</p>
  <p>d: {d}</p>
  <p>e: {e}</p>
  <p>f: {f}</p>
{/each}
