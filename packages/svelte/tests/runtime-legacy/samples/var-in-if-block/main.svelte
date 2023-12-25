<script>
	export var condition;

	if (condition) {
		var b = 123;
		var c = 0;
	} else {
		var d = 0;
		var e = 456;
	}
</script>

<p>{condition}</p>
{#if condition}
	<p>{b}</p>
	<p>{c}</p>
{:else}
	<p>{d}</p>
	<p>{e}</p>
{/if}