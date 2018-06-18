<template>
  <div class="about">
    <h2>About</h2>
    <dl>
      <dt>Is this safe?</dt>
      <dd>
        <p>
          Yes. No sensitive information is ever sent to any server except directly to the Let's Encrypt API servers.
          Your private keys are never sent anywhere and are used locally to sign outgoing requests.
        </p>
        <p>
          However, this still requires some level of trust that this website does not covertly steal your ACME account private key.
          This is the same as for websites like ZeroSSL, or for downloading projects from Github.
        </p>
        <p>
          You are free to get the
          <a href="https://github.com/letsdebug/letsdebug-toolkit" target="_blank" rel="noopener noreferrer">source code to this project off GitHub</a>
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
