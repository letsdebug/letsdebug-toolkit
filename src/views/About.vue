<template>
  <div class="about">
    <h2>About</h2>
    <dl>
      <dt>What's this?</dt>
      <dd>
        <p>
          This website includes various web-based tools to perform certificate-related debugging or
          maintenance tasks. It has been around since 2018 and is more-or-less actively maintained.
          This is a side project running next to
          <a href="https://letsdebug.net/" target="_blank" rel="noopener noreferrer">Let's Debug</a
          >.
        </p>
        <p>
          Feature requests, bug reports, pull requests and similar are welcome. The source code is
          <a
            href="https://github.com/letsdebug/letsdebug-toolkit"
            target="_blank"
            rel="noopener noreferrer"
            >here</a
          >.
        </p>
      </dd>
      <p></p>
      <dt>There are tools requesting private keys on this page. Is this safe?</dt>
      <dd>
        <p>
          Yes. No sensitive information is ever sent to any server except directly to the Let's
          Encrypt API servers. Your private keys are never sent anywhere and are used locally to
          sign outgoing requests.
        </p>
        <p>
          However, this still requires some level of trust that this website does not covertly steal
          your ACME account private key.
        </p>
        <p>
          You are free to get the
          <a
            href="https://github.com/letsdebug/letsdebug-toolkit"
            target="_blank"
            rel="noopener noreferrer"
            >source code to this project off GitHub</a
          >
          and run it locally.
        </p>
      </dd>
    </dl>
  </div>
</template>

<style lang="scss" scoped>
dt {
  font-weight: bold;
}
</style>
<script setup></script>
