<template>
  <div class="cert-revoke">
    <h2>cert-revoke</h2>
    <p>
      This tool can be used to revoke Let's Encrypt certificates, even if you do not control
      the original ACME account that initially issued the certificate.
    </p>
    <p>You will need to be able to fulfill the following requirements:</p>
    <ul>
      <li>You control each domain that appeared on the certificate. This is because you will need to perform
        either the HTTP or DNS validation for each domain, to gain the ability to revoke previous certificates.
      </li>
      <li>You either already have the final certificate PEM you wish to revoke (which you can download
        from your web server or using your browser or openssl), or it can sometimes be found on crt.sh.
        You must provide the final certificate, a (poisoned) pre-certificate is not suitable.
      </li>
    </ul>
    <h3>Usage</h3>
    <div v-if="error" class="error">
      <h4>An error occured</h4>
      <p>Unfortunately something went wrong during the process.
        Usually this is not recoverable - you will need to start from the beginning.
      </p>
      <p><em>{{ error }}</em></p>
      <div>
        <button @click="reset()" :disabled="loading" class="reset-button">Reset</button>
      </div>
    </div>
    <div v-else-if="revoked">
      <h4>Revocation Complete</h4>
      <p>Congratulations! The certificate revocation succeeded. You may verify this by checking
      the Let's Encrypt OCSP service in a while (it is heavily cached).</p>
      <div>
        <button @click="reset()" :disabled="loading" class="reset-button">Reset</button>
      </div>
    </div>
    <div class="cert-selection" v-else-if="!certConfirmed">
      <h4>(1/2) Which certificate to revoke?</h4>
      <div v-if="certSource === null">
        <p>How would you like to provide your certificate?</p>
        <select v-model="certSource">
          <option value="search">I'll find it on crt.sh</option>
          <option value="direct">I have the PEM file</option>
        </select>
      </div>
      <div v-else-if="certSource === 'search'">
        <p>Please find your certificate on
          <router-link :to='{ name: "cert-search", query: { d: 2160 } }' target="_blank">cert-search</router-link> and
          copy the Certificate PEM contents before continuing (it begins with <code>-----BEGIN CERTIFICATE-----</code>).</p>
        <button @click="certSource = 'direct'">OK, I've got my Certificate PEM</button>
      </div>
      <div v-else>
        <p>Please enter your certificate PEM below:</p>
        <div class="cert-display">
          <textarea class="cert-input" @change="pemUpdated" v-model="certPem" rows="10" cols="65"></textarea>
          <div class="cert-info">
            <div v-if="cert === null">Please enter a valid PEM certificate.</div>
            <div v-else>
              This certificate contains the following names.
              Ensure that you have the ability to either upload publicly accessible files or create DNS records for each of these domains
              before proceeding:
              <ul>
                <li v-for="name in certNames" v-bind:key="name">{{ name }}</li>
              </ul>
              <button @click="confirmCert()" :disabled="certNames.length === 0">OK, continue with this certificate</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="certConfirmed">
      <h4>(2/2) Revocation</h4>
      <p>Before the certificate can be revoked, you will need to perform authorizations for each of the names on the certificate.</p>
      <p v-if="loading"><em>Loading ... ({{ loadingTask }})</em></p>
      <div class="authz" v-for="authz in authzsToFulfill" v-bind:key="authz.url" v-if="!loading && !authz.fulfilled">
        <em>
          You are required to complete an authorization for <strong>{{ authz.identifier.value }}</strong> in order
          to be able to revoke this certificate.
        </em>
        <p>
          Please follow the instructions below to complete this authorization.
          You only need to complete one of HTTP or DNS validation - both are not required.
        </p>
        <details open v-if="authz.httpKeyAuthz">
          <summary>HTTP Challenge</summary>
          <p>
            For this challenge, create a file containing the following contents at
            <em>http://{{ authz.identifier.value }}/.well-known/acme-challenge/{{ authz.httpResource }}</em> :
          </p>
          <pre>{{ authz.httpKeyAuthz }}</pre>
          <button @click="completeChallenge(authz, 'http-01')" :disabled="loading" v-if="!authz.fulfilled">Complete HTTP Challenge</button>
        </details>
        <details open v-if="authz.dnsKeyAuthz">
          <summary>DNS Challenge</summary>
          <p>
            For this challenge, create a TXT record containing the following contents at
            <em>_acme-challenge.{{ authz.identifier.value }}</em> :
          </p>
          <pre>{{ authz.dnsKeyAuthz }}</pre>
          <button @click="completeChallenge(authz, 'dns-01')" :disabled="loading" v-if="!authz.fulfilled">Complete DNS Challenge</button>
        </details>
      </div>

      <button :disabled="loading" v-if="authzsRemaining === false && authzsToFulfill" @click="revokeCertificate()">
        Revoke the certificate
      </button>
      <button @click="reset()" :disabled="loading" class="reset-button">Reset</button>
    </div>
  </div>
</template>

<script>
import { X509 } from 'jsrsasign'
import { newClient } from '@/acme'

const ACME_DIR = 'acme-v02.api.letsencrypt.org'

export default {
  data: () => {
    return {
      certSource: null,
      certPem: null,
      cert: null,
      certConfirmed: false,
      loading: false,
      loadingTask: '',
      acmeClient: null,
      error: null,
      authzs: null,
      revoked: false
    }
  },
  methods: {
    pemUpdated: function () {
      this.cert = null
      if (!this.certPem || this.certPem === '') {
        return
      }
      try {
        const cert = new X509()
        cert.readCertPEM(this.certPem)
        this.cert = cert
      } catch (e) {
        console.log(e)
      }
    },
    confirmCert: async function () {
      this.certConfirmed = true
      this.loading = true
      this.loadingTask = ''
      this.authzs = null
      try {
        this.loadingTask = 'Creating/fetching an ACME account'
        this.acmeClient = await newClient(ACME_DIR)

        this.loadingTask = 'Creating an ACME order'
        const order = await this.acmeClient.newOrder(this.cert.getExtSubjectAltName2().map(v => v[1]))

        this.loadingTask = 'Fetching authorizations'
        const authzs = await Promise.all(order.data.authorizations.map(async (v) => {
          const authz = await this.acmeClient.postAsGet(v)
          authz.data.url = v
          return authz
        }))
        authzs.forEach((o, i, a) => {
          const httpChal = this.challOfType(a[i].data, 'http-01')
          // HTTP challenge may not be present if its a wildcard identifier
          if (httpChal) {
            a[i].data.httpResource = httpChal.token
            a[i].data.httpKeyAuthz = this.acmeClient.keyAuthz(httpChal.token)
          }
          const dnsChal = this.challOfType(a[i].data, 'dns-01')
          // DNS challenge should always be available, but better to be safe
          if (dnsChal) {
            a[i].data.dnsKeyAuthz = this.acmeClient.dnsKeyAuthz(dnsChal.token)
            a[i].data.fulfilled = false
          }
        })
        this.authzs = authzs
      } catch (e) {
        console.log('Error creating acme client', e)
        this.error = 'toString' in e ? e.toString() : e
      }
      this.loading = false
      this.loadingTask = ''
    },
    revokeCertificate: async function () {
      this.loading = true
      try {
        // 1. revoke
        this.loadingTask = 'Revoking certificate'
        await this.acmeClient.revokeCertificate(this.cert.hex)
        // 2. deactivate authorizations
        this.loadingTask = 'Cleaning up - Deactivating authorizations'
        for (const authz of this.authzs) {
          try {
            await this.acmeClient.deactivateAuthz(authz.data.url)
          } catch (e) {
            console.log('Failed to deactivate authz', authz, e)
          }
        }
        this.revoked = true
      } catch (e) {
        console.log(e)
        this.error = 'toString' in e ? e.toString() : e
      }
      this.loading = false
    },
    challOfType: function (authz, type) {
      return authz.challenges.filter(c => c.type === type)[0]
    },
    completeChallenge: async function (authz, type) {
      const chal = this.challOfType(authz, type)
      this.loading = true
      this.loadingTask = 'Responding to challenge'
      try {
        await this.acmeClient.respondChallenge(chal.url)
        await this.acmeClient.pollChallenge(chal.url)
      } catch (e) {
        this.error = 'toString' in e ? e.toString() : e
      }
      this.loading = false
      this.loadingTask = ''
      authz.fulfilled = true
    },
    reset: function () {
      this.certSource = null
      this.certPem = null
      this.cert = null
      this.certConfirmed = null
      this.loading = null
      this.error = null
      this.authzs = null
      this.revoked = false
      this.acmeClient = null
    }
  },
  computed: {
    certNames: function () {
      if (!this.cert) {
        return
      }
      try {
        return this.cert.getExtSubjectAltName2().map(v => v[1])
      } catch (e) {
        return []
      }
    },
    authzsToFulfill: function () {
      if (!this.authzs) {
        return []
      }
      return this.authzs.filter(v =>
        v.data.status === 'pending'
      ).map(v => v.data)
    },
    authzsRemaining: function () {
      const authzs = this.authzsToFulfill
      return authzs.filter(a => a.fulfilled === false).length > 0
    }
  }
}
</script>

<style lang="scss" scoped>
.cert-display {
  display: flex;
  flex-direction: row;
  .cert-info {
    margin: 0 1rem;
  }
}
.authz {
  background: whitesmoke;
  padding: 1rem 2rem;
  margin-bottom: 1rem;
}
details {
  margin-bottom: 1rem;
}
</style>
