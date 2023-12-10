<template>
  <div class="hello">
    <p>
      This website includes various web-based tools to perform certificate-related debugging or
      maintenance tasks.
    </p>
    <p>
      If you're looking to issue an SSL certificate, check out
      <a href="https://letsencrypt.org/getting-started/" target="_blank" rel="noopener noreferrer"
        >Let's Encrypt</a
      >
      instead.
    </p>
    <p>The following tools are currently offered here:</p>
    <h2>Let's Debug</h2>
    <p>Figure out why your certificate issuance might be failing.</p>
    <a href="https://letsdebug.net/" target="_blank" rel="noopener noreferrer">Use Let's Debug</a>
    <h2>clear-authz</h2>
    <p>
      If you're facing the <em>too many pending authorizations </em>
      <a target="_blank" rel="noopener noreferrer" href="https://letsencrypt.org/docs/rate-limits/"
        >rate limiting condition</a
      >, this can help you clear them out so you can continue to use your ACME account.
    </p>
    <router-link :to="{ name: 'clear-authz' }">Use clear-authz</router-link>
    <h2>cert-revoke</h2>
    <p>Revoke certificates directly from the browser.</p>
    <router-link :to="{ name: 'cert-revoke' }">Use cert-revoke</router-link>
    <h2>cert-search</h2>
    <p>
      An alternate user interface to
      <a href="https://crt.sh" rel="noopener noreferrer" target="_blank">crt.sh</a> to emphasize
      functionalities important to users of Let's Encrypt.
    </p>
    <router-link :to="{ name: 'cert-search' }">Use cert-search</router-link>
  </div>
</template>

<script>
export default {
  name: 'HelloWorld'
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
h3 {
  margin: 40px 0 0;
}
</style>