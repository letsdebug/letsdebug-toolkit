<template>
  <div class="cert-search">
    <h2>cert-search</h2>

    <form class="search-form" @submit="navigateSearch()" @submit.prevent=";">
      <select v-model="searchMode" @change="query = null; $refs.search.focus()">
        <option value="domain">Search by domain</option>
        <option value="expiry">Search by expiry/notAfter</option>
        <option value="serial">Search by exact serial</option>
        <option value="sql">Search by raw SQL</option>
      </select>
      <input ref="search" type="search" :placeholder="searchPlaceholder" v-model="query">
      <select v-model="dateIntervalHours" v-if="searchMode != 'sql' && searchMode != 'serial' && searchMode != 'expiry'">
        <option value=1>in the last 1 hour</option>
        <option value=24 selected>in the last 1 day</option>
        <option value=168>in the last 7 days</option>
        <option value=744>in the last 31 days</option>
        <option value=2160>in the last 91 days</option>
      </select>
      <input type="submit" :disabled="loading" value="Search"/>
    </form>

    <p v-if="loading">Searching ...</p>
    <p v-else-if="haveResults">
      Found {{ sortedResults.length }} certificates issued.
    </p>

    <div v-if="haveResults && searchedMode === 'domain'">
      <h4>Rate Limit Status</h4>
      <table class="results">
        <tr>
          <th width="20%">Rate Limit</th>
          <th>Status</th>
        </tr>
        <tr>
          <td>
            <span>Certificates per Registered Domain</span>
          </td>
          <td>This Registered Domain (TODO:XXX) has used
            <span :class="{'bad': response.totalWithinWeek >= 20}">{{ response.totalWithinWeek }} of 20</span> weekly certificates.</td>
        </tr>
        <tr>
          <td>
            <span>Duplicate Certificates</span>
          </td>
          <td>
            <table class="duplicate-certs">
              <tr v-for="(v, k) in response.groupByNames" v-bind:key="k" v-if="v.length > 1">
                <td width="50%"><div class="long-names">{{ k }}</div></td>
                <td width="50%"><span :class="{'bad': v.length >= 5}">{{ v.length }} of 5</span> weekly certificates.</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <h4 v-if="haveResults">Certificates</h4>
    <table v-if="haveResults" class="results">
      <tr>
        <th>Serial/crt.sh link</th>
        <th>Issued</th>
        <th colspan="2">Domain List</th>
      </tr>
      <template v-for="result in sortedResults" :id="result.serial" :class="{'within-week': result.is_within_week}">
        <tr class="cert-row" v-bind:key="result.crtsh_id + '-entry'" :id="result.serial" :class="{'within-week': result.is_within_week}">
          <td width="20%">
            <a class="serial" target="_blank" rel="noopener noreferrer nofollow" :href="'https://crt.sh/?id=' + result.crtsh_id">{{ result.serial.slice(-12) }}</a>
            <span class="cert-type">{{ result.cert_type }}</span>
          </td>
          <td width="30%">
            <abbr :title="formatDateTitle(result.not_before)">{{ formatDate(result.not_before) }}</abbr> <br>
            <span class="expiry">Expires in <abbr :title="formatDate(result.not_after)">{{ formatDateTitle(result.not_after) }}</abbr></span>
            <div class="rate-limit-note" v-if="result.is_within_week && result.num_duplicates > 1" :class="{'bad': result.num_duplicates >= 5}">
              {{ result.num_duplicates }}/5 Duplicate Certificates this week
            </div>
          </td>
          <td width="48%">
            <span class="name" v-for="name in result.all_names" v-bind:key="name">{{ name }}</span>
          </td>
          <td class="detail-toggle" :class="{'selected': selectedCert === result.crtsh_id}" @click="selectedCert = selectedCert === result.crtsh_id ? null : result.crtsh_id">
            <div>^</div>
          </td>
        </tr>
        <tr class="cert-detail" v-bind:key="result.crtsh_id + '-detail'" v-if="selectedCert === result.crtsh_id">
          <td colspan="5">
            <table>
              <tr>
                <td>crt.sh Link</td>
                <td><a :href="'https://crt.sh/?id=' + result.crtsh_id" target="_blank" rel="noopener noreferrer nofollow">
                  https://crt.sh/?id={{ result.crtsh_id }}
                </a></td>
              </tr>
              <tr>
                <td width="30%">Certificate Serial</td>
                <td>{{ result.cert.getSerialNumberHex() }}</td>
              </tr>
              <tr>
                <td>Not Before</td>
                <td>{{ formatDate(result.not_before) }}</td>
              </tr>
              <tr>
                <td>Not After</td>
                <td>{{ formatDate(result.not_after) }}</td>
              </tr>
              <tr>
                <td>Subject</td>
                <td>{{ result.cert.getSubjectString() }}</td>
              </tr>
              <tr>
                <td>DNS Names</td>
                <td>
                  <div v-for="altName in result.cert.getExtSubjectAltName2()" v-bind:key="altName[1]">
                    {{ altName[1] }}
                  </div>
                </td>
              </tr>
              <tr>
                <td>Signature Algorithm</td>
                <td>{{ result.cert.getSignatureAlgorithmField() }}</td>
              </tr>
              <tr>
                <td>Signature</td>
                <td class="signature">{{ result.cert.getSignatureValueHex() }}</td>
              </tr>
              <tr>
                <td>Issuer</td>
                <td>{{ result.cert.getIssuerString() }}</td>
              </tr>
              <tr>
                <td>Public Key Algorithm</td>
                <td>{{ result.cert.getPublicKey().type }}</td>
              </tr>
              <tr>
                <td>Subject Key Identifier</td>
                <td>{{ result.cert.getExtSubjectKeyIdentifier() }}</td>
              </tr>
              <tr>
                <td>Certificate PEM</td>
                <td>
                  <textarea readonly v-model="result.pem"></textarea>
                  <p v-if="result.cert_type === 'Pre-Certificate'">Please keep in mind, this PEM is a pre-certificate
                    and can't be used to serve traffic.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </template>
      <tr v-if="!loading && sortedResults.length === 0">
        <td colspan="3">No certificates found in that time period.</td>
      </tr>
    </table>

    <p>Powered by <a href="https://crt.sh" target="_blank" rel="noopener noreferrer">crt.sh</a></p>
  </div>
</template>

<script>
import axios from 'axios'
import { rstrtohex, X509, zulutodate, KJUR } from 'jsrsasign'
import moment from 'moment'

const createDomainQuery = (domain, dateIntervalHours) => {
  return `select c.id as crtsh_id, c.CERTIFICATE as der \
  from certificate c, certificate_identity ci \
  where reverse(lower(ci.NAME_VALUE)) LIKE reverse('%${domain}') AND \
  x509_notBefore(c.CERTIFICATE) > NOW() - INTERVAL '${dateIntervalHours} hours' AND ci.CERTIFICATE_ID = c.ID AND \
  ci.issuer_ca_id = 16418 AND ci.name_type = 'dNSName'
  ORDER BY x509_notBefore(c.CERTIFICATE) DESC
  OFFSET 0 LIMIT 1000;`
}

const createExpiryQuery = (dateString, dateIntervalHours) => {
  try {
    dateString = dateString.trim()
    let d = null
    // First try the format used  by crt.sh and openssl x509
    if (dateString.indexOf('GMT') === dateString.length - 3) {
      d = moment.utc(dateString, 'MMM D HH:mm:ss YYYY')
    } else { /* Otherwise hope the user passed iso8601 */
      d = moment(dateString)
    }
    if (!d || !d.isValid()) {
      throw new Error(`${dateString} isn't a Date string we understand, sorry!`)
    }
    return `select c.id as crtsh_id, c.CERTIFICATE as der \
    from certificate c \
    where x509_notAfter(c.CERTIFICATE) = '${d.utc().format(`YYYY-MM-DD HH:mm:ss`)}' AND \
    x509_issuerName(c.CERTIFICATE) LIKE 'C=US, O=Let''s Encrypt%';`
  } catch (e) {
    console.log(`Can't parse date`, e)
    window.alert(e)
    return null
  }
}

const createSerialQuery = (serial, dateIntervalHours) => {
  return `select c.id as crtsh_id, c.CERTIFICATE as der \
  from certificate c, certificate_identity ci \
  where x509_serialNumber(c.CERTIFICATE) = decode('${serial.split(':').join('').trim()}', 'hex') AND \
  ci.CERTIFICATE_ID = c.ID AND \
  ci.issuer_ca_id = 16418 AND ci.name_type = 'dNSName'
  ORDER BY x509_notBefore(c.CERTIFICATE) DESC
  OFFSET 0 LIMIT 1000;`
}

const doQuery = async (query) => {
  if (query === null) {
    return
  }
  const encodedQuery = encodeURIComponent(query)
  const response = await axios({
    method: 'GET',
    url: `https://letsdebug.net/certwatch-query?q=${encodedQuery}`
  })
  // We don't want duplicate precerts and leaf certificates
  // So group by serial and prefer leaf over precert
  const groupBySerial = {}
  // We also want to track duplicate (for the meaning of duplicate
  // where the set of dNSNames are identical) to work out rate limits
  const groupByNames = {}
  const weekAgo = moment().subtract(7, 'day')
  // Track total certs for Registered Domain within 7 days
  let totalWithinWeek = 0
  // Post-process the results
  response.data.results = response.data.results || []
  for (let i = 0; i < response.data.results.length; i++) {
    try {
      const cert = new X509()
      const hexBytes = rstrtohex(atob(response.data.results[i].der))
      cert.readCertHex(hexBytes)
      const serial = cert.getSerialNumberHex()
      const isPrecert = cert.getExtInfo('1.3.6.1.4.1.11129.2.4.3') !== undefined

      const haveDuplicateSerial = typeof groupBySerial[serial] !== 'undefined'
      // If we already have this serial, and we haven't found an unpoisoned certificate
      // then we can skip the certificate we're looking at
      if (haveDuplicateSerial && isPrecert) {
        continue
      }
      const entry = {
        crtsh_id: response.data.results[i].crtsh_id,
        cert,
        all_names: cert.getExtSubjectAltName2().map(v => v[1]),
        not_before: zulutodate(cert.getNotBefore()),
        not_after: zulutodate(cert.getNotAfter()),
        cert_type: isPrecert ? 'Pre-Certificate' : 'Certificate',
        serial,
        pem: KJUR.asn1.ASN1Util.getPEMStringFromHex(hexBytes, 'CERTIFICATE')
      }
      entry.is_within_week = moment(entry.not_before).isAfter(weekAgo)
      groupBySerial[serial] = entry

      if (!haveDuplicateSerial && entry.is_within_week) {
        totalWithinWeek++
        const namesKey = entry.all_names.join(', ')
        if (typeof groupByNames[namesKey] !== 'undefined') {
          groupByNames[namesKey].push(entry.all_names)
        } else {
          groupByNames[namesKey] = [entry.all_names]
        }
      }
    } catch (e) {
      console.log('Error reading certificate', e)
    }
  }
  const final = Object.values(groupBySerial)
  for (let i = 0; i < final.length; i++) {
    const namesKey = final[i].all_names.join(', ')
    if (typeof groupByNames[namesKey] !== 'undefined') {
      final[i].num_duplicates = groupByNames[namesKey].length
    }
  }
  response.data.results = final
  response.data.totalWithinWeek = totalWithinWeek
  response.data.groupByNames = groupByNames
  response.data.groupBySerial = groupBySerial
  return response.data
}

export default {
  data: function () {
    return {
      response: null,
      loading: false,
      query: null,
      dateIntervalHours: 168,
      searchMode: 'domain',
      searchedMode: null,
      selectedCert: null
    }
  },
  methods: {
    navigateSearch: function () {
      this.$router.push({ name: 'cert-search', query: { m: this.searchMode, q: this.query, d: this.dateIntervalHours } })
      this.reload()
    },
    search: async function () {
      this.response = null
      this.searchedMode = null
      this.loading = true
      try {
        let queryFunc = null
        switch (this.searchMode) {
          case 'domain':
            queryFunc = createDomainQuery
            break
          case 'expiry':
            queryFunc = createExpiryQuery
            break
          case 'serial':
            queryFunc = createSerialQuery
            break
          case 'sql':
            queryFunc = () => this.query
            break
        }
        this.response = await doQuery(queryFunc(this.query, this.dateIntervalHours))
        this.searchedMode = this.searchMode
      } catch (e) {
        console.log('Search error', e)
      }
      this.loading = false
    },
    formatDate: function (d) {
      return moment(d).toISOString()
    },
    formatDateTitle: function (d) {
      return moment(d).fromNow()
    },
    reload: function () {
      if (this.$route.query.q) {
        this.query = this.$route.query.q
      }
      if (this.$route.query.d) {
        try {
          this.dateIntervalHours = parseInt(this.$route.query.d)
        } catch (e) {
          this.dateIntervalHours = 168
        }
      }
      if (this.$route.query.m) {
        this.searchMode = this.$route.query.m
      }
      if (this.query) {
        this.search()
      }
    }
  },
  computed: {
    sortedResults: function () {
      if (!this.response || !this.response.results) {
        return []
      }
      return this.response.results
    },
    haveResults: function () {
      return !this.loading && this.response &&
      typeof this.response.totalWithinWeek !== 'undefined'
    },
    searchPlaceholder: function () {
      switch (this.searchMode) {
        case 'domain':
          return 'ASCII-encoded domain name'
        case 'expiry':
          return 'crt.sh or ISO8601 format date'
        case 'serial':
          return 'Full certificate serial, hex-encoded'
        case 'sql':
          return `e.g. select c.id as crtsh_id, c.CERTIFICATE as der from certificate \
c where x509_subjectKeyIdentifier(c.CERTIFICATE) = decode('deadf00d','hex')`
      }
    }
  },
  mounted: function () {
    this.$refs.search.focus()
  },
  created: function () {
    this.reload()
  },
  watch: {
    '$route': function () {
      this.reload()
    }
  }
}
</script>

<style lang="scss" scoped>
.results {
  width: 100%;
  margin-bottom: 2rem;
  th {
    background: #2c3c69;
    color: white;
  }
  th, td {
    padding: 0.5rem 1rem;
  }
  tr:nth-child(odd):not(.cert-detail) {
    background: whitesmoke;
    &.within-week {
      background: mix(whitesmoke, green, 95%);
    }
  }
  tr {
    &.within-week {
      background: mix(whitesmoke, lightgreen, 95%);
    }
    &.cert-detail {
      background: mix(whitesmoke, #2c3c69, 95%);
      table {
        width: 100%;
        word-wrap: break-word;
        word-break: break-all;
      }
      textarea {
        width: 100%;
        min-height: 200px;
      }
    }
  }
  .name {
    display: block;
    font-size: 0.9rem;
    padding: 0 0.25rem;
    margin: 0.25rem;
  }
  .cert-type {
    display: block;
    text-transform: uppercase;
    font-size: 0.8rem;
  }
  .serial {
    font-family: monospace;
    text-transform: uppercase;
    font-size: 0.9rem;
    &::before {
      content: "...";
    }
  }
  .expiry, .rate-limit-note {
    font-size: 0.8rem;
    &.bad {
      color: red;
      font-size: 1rem;
    }
  }
}
.search-form {
  display: flex;
  flex-direction: row;
  width: 100%;
  input[type='search'] {
    flex-grow: 1;
  }
  input, select {
    padding: 0.25rem;
  }
}
.bad {
  color: red;
  font-size: 1rem;
  font-weight: bold;
}
.duplicate-certs {
  tr:nth-child(odd) {
    background: white;
  }
  .long-names {
    font-size: 0.75rem;
  }
}
.detail-toggle {
  user-select: none;
  cursor: pointer;
  font-size: 1.2rem;
  font-weight: bold;
  transition: transform 0.1s linear;
  &.selected {
    transform: rotate(180deg);
  }
}
</style>
