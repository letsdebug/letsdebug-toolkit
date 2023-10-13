<template>
  <div class="clear-authz">
    <h2>clear-authz</h2>
    <p>This tool can be helpful if you are faced with the following error message:</p>
    <blockquote>urn:acme:error:rateLimited :: There were too many requests of a given type :: Error creating new authz :: too many currently pending authorizations.</blockquote>
    <p>
      This usually occurs when you have created a lot of certificate orders that were left unfilfilled. The usual cause of this
      is a malfunctioning ACME client.
    </p>
    <p>
      This tool can help by scanning your ACME client logs (e.g. <code>/var/log/letsencrypt/*</code>) for pending authorizations
      and then intentionally failing them, in order to reduce your pending authorization count.
    </p>
    <p>This tool is compatible only with ACME v2 clients (but only currently with RSA keys, as with Certbot).</p>
    <h3>Usage</h3>
    <p>You will need to be able to run commands on your server via SSH.</p>
    <!-- Prompt the user to upload their logs -->
    <div :class="{'task-complete': logLines !== null}">
      <h4>1. Gather your logs</h4>
      <p>Find all of the authz URLs in your ACME client's logs. For Certbot, these are located in
        <code>{{ logsDir }}</code> .</p>
      <p>To do this, SSH into your server as root and upload your authz URLs (they are not sensitive &amp; will be deleted after 10 minutes):</p>
      <code class="ssh">grep -Ri "/acme/authz" {{ logsDir }}/* | curl -m60 --data-binary @- https://letsdebug.net/_/{{ token }}</code>
    </div>
    <div :class="{'task-complete': authzCount !== 0}">
      <h4>2. Scan your logs</h4>
      <div class="upload-options">
        <div class="upload-option">
          <p>Continue once you've run the above <code>curl</code> command and it indicates completion.</p>
          <button @click="downloadLogs" :disabled="loading">Continue</button>
        </div>
        <div class="upload-option">
          <p>For the paranoid, provide a single logfile manually (processed inside your browser):</p>
          <input type="file" v-on:change="handleUpload">
        </div>
      </div>
    </div>
    <!-- We need the ACME account key in order to GET the authorization URLs -->
    <div v-if="authzCount !== 0" :class="{'task-complete': accountsDone }">
      <h4>3. Provide your ACME account key(s) in JWK format</h4>
      <p>In order to check the authorizations (via signed POST-as-GET requests), this tool needs your ACME accounts' private keys.
      </p>
      <p>The account keys will not be sent over the network - only your browser will see them.</p>
      <div v-for="(key, server) in accountKeys" v-bind:key="server" :class="{'hidden': accountsDone}">
        <h5>Please provide the ACME account private key for {{ server }}</h5>
        <code class="ssh">
          find /etc/letsencrypt/accounts/{{ server }} -name private_key.json -exec cat {} \;
        </code>
        <textarea rows="5" v-model="accountKeys[server]"></textarea>
      </div>
      <button :disabled="loading" @click="scanChallenges">Continue</button>
    </div>
    <!-- We have the account keys, now check the authorizations -->
    <div v-if="authzCount !== 0" :class="{'task-complete': challengesFound === true && challenges.length > 0 }">
      <h4>4. Wait for each authz to be checked ...</h4>
      <p>Please wait until we have found all of the pending authorizations.</p>
      <p>
        <em>Found {{ processedCount }} unique authorizations in {{ authzCount }} lines ...</em>
      </p>
      <p>
        <em>Checked {{ checkCount }} of {{ processedCount }} authorizations ...</em>
      </p>
      <p>
        <em>Found {{ challenges.length }} pending authorizations.</em>
      </p>
    </div>
    <!-- Wait for deactivations -->
    <div v-if="clearLog !== null">
      <h4>5. Final step: wait for the process to complete</h4>
      <p v-for="line in clearLog" v-bind:key="line">
        {{ line }}
      </p>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import { getClient } from '@/acme'
import jsrsasign from 'jsrsasign'

export default {
  data: function () {
    return {
      logsDir: '/var/log/letsencrypt',
      logLines: null,
      processed: [],
      processedCount: 0,
      authzCount: 0,
      checkCount: 0,
      challenges: [],
      challengesFound: false,
      accountKeys: {},
      clearLog: null,
      worker: null,
      token: null,
      loading: false,
      accountsDone: false,
      clients: {}
    }
  },
  methods: {
    reset: function () {
      this.procesed = []
      this.processedCount = 0
      this.authzCount = 0
      this.logLines = null
      this.checkCount = 0
      this.challenges = []
      this.challengesFound = false
      this.accountKeys = {}
      this.clearLog = null
      this.accountsDone = false
      this.clients = {}
    },
    handleUpload: function (e) {
      if (e.target.files.length !== 1) {
        window.alert('Only provide 1 file to scan')
        return
      }
      this.reset()
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onload = () => {
        this.logLines = reader.result
        this.worker.postMessage(this.logLines)
      }
      reader.readAsText(file)
    },
    handleScan: function (e) {
      const msg = e.data
      switch (msg.kind) {
        case 'count':
          this.authzCount = msg.data
          this.scrollDown()
          break
        case 'processed':
          this.processed = msg.data
          this.processedCount = this.processed.length
          this.scanAccounts()
          break
      }
    },
    downloadLogs: async function () {
      this.reset()
      this.loading = true
      try {
        const resp = await axios.get('https://letsdebug.net/_/' + this.token)
        this.logLines = resp.data
        this.worker.postMessage(this.logLines)
      } catch (e) {
        console.log(e)
        window.alert('Failed to download logs. Try manually uploading them.')
      }
      this.loading = false
    },
    scanAccounts: function () {
      for (let i = 0; i < this.processed.length; i++) {
        const url = this.processed[i]
        const el = document.createElement('a')
        el.href = url
        this.accountKeys[el.hostname] = this.accountKeys[el.hostname] || ''
      }
    },
    scanChallenges: async function () {
      for (const server in this.accountKeys) {
        const key = this.accountKeys[server]
        try {
          JSON.parse(key)
        } catch (e) {
          console.log(server, key, e)
          window.alert(`The key for ${server} is not valid, press check that the full JSON value is present: ${e}`)
          for (const k in this.accountKeys) {
            this.accountKeys[k] = null
          }
          return
        }
      }
      this.accountsDone = true

      const now = new Date().getTime()
      for (var i = 0; i < this.processed.length; i++) {
        const url = this.processed[i]
        try {
          const el = document.createElement('a')
          el.href = url

          this.clients[el.hostname] = this.clients[el.hostname] ||
                                      getClient(this.accountKeys[el.hostname], el.hostname)

          const resp = await this.clients[el.hostname].postAsGet(url)
          if (resp.data && resp.data.status === 'pending' && new Date(resp.data.expires).getTime() > now) {
            this.challenges.push(resp.data.challenges[0].url || resp.data.challenges[0].uri)
          }
        } catch (e) {
          console.log(url, e)
        }
        this.checkCount++
      }
      this.challengesFound = true
      this.scrollDown()
      this.clearAuthzs()
    },
    clearAuthzs: async function () {
      this.loading = true
      this.clearLog = []
      this.scrollDown()
      for (let i = 0; i < this.challenges.length; i++) {
        const url = this.challenges[i]

        const el = document.createElement('a')
        el.href = url

        this.clearLog.push(`${i + 1}/${this.challenges.length}: Trying to clear ${url} ...`)
        try {
          await this.clients[el.hostname].respondChallenge(url)
          this.clearLog.push(`${i + 1}/${this.challenges.length}: Cleared ${url} successfully.`)
        } catch (e) {
          this.clearLog.push(`${i + 1}/${this.challenges.length}: Couldn't clear ${url} (error).`)
        }
        this.scrollDown()
      }
      this.clearLog.push('Finished.')
    },
    scrollDown: function () {
      this.$nextTick(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        })
      })
    }
  },
  created: function () {
    this.token = jsrsasign.KJUR.crypto.Util.getRandomHexOfNbits(32)
  },
  mounted: function () {
    this.worker = new Worker(new URL('@/assets/workerLogScanner.js', import.meta.url))
    this.worker.onmessage = this.handleScan
  },
  beforeUnmount: function () {
    if (this.worker !== null) {
      this.worker.terminate()
      this.worker = null
    }
  }
}
</script>

<style lang="scss" scoped>
blockquote {
  font-family: 'Courier New', Courier, monospace;
}
code {
  font-size: 1rem;
}
.ssh {
  font-size: 1rem;
  background: #2c3e50;
  color: white;
  width: 100%;
  display: block;
  padding: 0.5rem;
}
.ssh::before {
  content: "# ";
}
.upload-options {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  .upload-option {
    width: 45%;
  }
}
textarea {
  width: 100%;
  margin: 1rem 0;
}
.hidden {
  display: none;
}
</style>
