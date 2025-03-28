<template>
  <div class="cert-search">
    <p>
      Note: For performance reasons, this tool only shows certificates issued by Let's Encrypt.
      Certificates from other certificate authorities are filtered. This tool always searches the
      entire registered ("apex") domain (including all subdomains), even if only a specific
      subdomain is entered in the search field.
    </p>
    <h2>cert-search</h2>

    <form class="search-form" @submit="navigateSearch()" @submit.prevent="">
      <select v-model="searchMode" @change="(query = null), $refs.search.focus()">
        <option value="domain">Search by domain</option>
        <option value="sql">Search by raw SQL</option>
      </select>
      <input ref="search" type="search" :placeholder="searchPlaceholder" v-model="query" />
      <select v-model="dateIntervalHours" v-if="searchMode === 'domain'">
        <option value="168">in the last 7 days</option>
        <option value="744">in the last 31 days</option>
        <option value="2160">in the last 90 days</option>
        <option value="4320">in the last 180 days</option>
        <option value="8760">in the last 365 days</option>
      </select>
      <input type="submit" :disabled="loading" value="Search" />
    </form>

    <p v-if="loading">Searching ...</p>
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    <p v-else-if="haveResults">Found {{ sortedResults.length }} certificates issued.</p>

    <div v-if="haveResults && searchedMode === 'domain'">
      <div class="rate-limit-title">
        <h4>Rate Limit Status</h4>
        <a class="fake-link" style="align-self: center" @click="useLocalTZ = !useLocalTZ">
          Switch to <span v-if="useLocalTZ">UTC</span><span v-else>local</span> dates</a
        >
      </div>
      <table class="results">
        <tr>
          <th style="width: 20%">Rate Limit</th>
          <th>Status</th>
        </tr>
        <tr>
          <td>
            <a
              href="https://letsencrypt.org/docs/rate-limits/#certificates-per-registered-domain"
              target="_blank"
              rel="noopener noreferrer"
              >Certificates per Registered Domain</a
            >
          </td>
          <td>
            The Registered Domain ({{ registeredDomain }}) has used
            <span :class="{ bad: response.totalWithinWeek >= CERTS_PER_REG_DOMAIN_PER_WEEK }">
              {{ response.totalWithinWeek }} of {{ CERTS_PER_REG_DOMAIN_PER_WEEK }}
            </span>
            weekly certificates.
            <p
              class="next-issue-date"
              v-if="response.totalWithinWeek >= CERTS_PER_REG_DOMAIN_PER_WEEK"
            >
              The next non-renewal certificate for {{ registeredDomain }} will be issuable again on
              <abbr :title="formatDateTitle(nextIssuableDate)">
                {{ formatDate(nextIssuableDate) }}
              </abbr>
            </p>
            <p>
              <small
                >Due to
                <a
                  href="https://community.letsencrypt.org/t/rate-limits-fixing-certs-per-name-rate-limit-order-of-operations-gotcha/88189"
                  target="_blank"
                  rel="noopener noreferrer"
                  >changes in how Let's Encrypt applies the renewal exemption</a
                >, this calculation is no longer accurate (overestimating how close a domain is to
                this rate limit) and is unlikely to be fixed.
              </small>
            </p>
          </td>
        </tr>
        <tr>
          <td>
            <a
              href="https://letsencrypt.org/docs/rate-limits/#duplicate-certificate"
              target="_blank"
              rel="noopener noreferrer"
              >Duplicate Certificates</a
            >
          </td>
          <td>
            <table class="duplicate-certs">
              <template v-for="(v, k) in response.groupByNames" v-bind:key="k">
                <tr v-if="v.length >= 1">
                  <td style="width: 50%">
                    <div class="long-names">{{ k }}</div>
                  </td>
                  <td style="width: 50%">
                    <span :class="{ bad: v.length >= 5 }">{{ v.length }} of 5</span> weekly
                    certificates.
                    <div class="next-issue-date" v-if="v.length >= 5">
                      The next time this certificate can be issued is
                      <abbr
                        :title="formatDateTitle(addWeek(response.firstCertByName[k].not_before))"
                      >
                        {{ formatDate(addWeek(response.firstCertByName[k].not_before)) }}
                      </abbr>
                    </div>
                  </td>
                </tr>
              </template>
            </table>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 1rem 0 0 0">
            <a class="fake-link" @click="copySummary">Copy rate limit summary to clipboard</a>.
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
      <template v-for="result in sortedResults" :key="result.crtsh_id + '-entry'">
        <tr class="cert-row" :id="result.serial" :class="{ 'within-week': result.is_within_week }">
          <td style="width: 20%">
            <a
              class="serial"
              target="_blank"
              rel="noopener noreferrer nofollow"
              :href="'https://crt.sh/?id=' + result.crtsh_id"
              >{{ result.serial.slice(-12) }}</a
            >
            <span class="cert-type">{{ result.cert_type }}</span>
          </td>
          <td style="width: 30%">
            <abbr :title="formatDateTitle(result.not_before)">{{
              formatDate(result.not_before)
            }}</abbr>
            <br />
            <span class="expiry">
              <abbr :title="formatDate(result.not_after)">{{
                formatDateTitleWithPrefix(result.not_after)
              }}</abbr></span
            >
            <div
              class="rate-limit-note"
              v-if="result.is_within_week && result.num_duplicates > 1"
              :class="{ bad: result.num_duplicates >= 5 }"
            >
              {{ result.num_duplicates }}/5 Duplicate Certificates this week
            </div>
          </td>
          <td style="width: 48%">
            <span class="name" v-for="name in result.all_names" v-bind:key="name">{{ name }}</span>
          </td>
          <td
            class="detail-toggle"
            :class="{ selected: selectedCert === result.crtsh_id }"
            @click="selectedCert = selectedCert === result.crtsh_id ? null : result.crtsh_id"
          >
            <div>^</div>
          </td>
        </tr>
        <tr
          class="cert-detail"
          v-bind:key="result.crtsh_id + '-detail'"
          v-if="selectedCert === result.crtsh_id"
        >
          <td colspan="5">
            <table>
              <tr>
                <td style="width: 32%">crt.sh Link</td>
                <td>
                  <a
                    :href="'https://crt.sh/?id=' + result.crtsh_id"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    https://crt.sh/?id={{ result.crtsh_id }}
                  </a>
                </td>
              </tr>
              <tr>
                <td>Certificate Serial</td>
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
                  <div
                    v-for="altName in result.cert.getExtSubjectAltName().array"
                    v-bind:key="altName"
                  >
                    {{ Object.values(altName)[0] }}
                  </div>
                </td>
              </tr>
              <tr>
                <td>Signature Algorithm</td>
                <td>{{ result.cert.getSignatureAlgorithmField() }}</td>
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
                <td>Public Key Fingerprint (SHA-256)</td>
                <td>{{ getSPKIHash(result.cert) }}</td>
              </tr>
              <tr>
                <td>Subject Key Identifier</td>
                <td>{{ result.cert.getExtSubjectKeyIdentifier().kid.hex }}</td>
              </tr>
              <tr>
                <td>Certificate Fingerprint (SHA-256)</td>
                <td>{{ getCertHash(result.cert) }}</td>
              </tr>
              <tr>
                <td>Certificate PEM</td>
                <td>
                  <textarea readonly v-model="result.pem"></textarea>
                  <p v-if="result.cert_type === 'Pre-Certificate'">
                    Please keep in mind, this PEM is a pre-certificate and can't be used to serve
                    traffic or perform revocations.
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
import 'moment-timezone'
import psl from 'psl'

const CERTS_PER_REG_DOMAIN_PER_WEEK = 50

const createDomainQuery = (domain, dateIntervalHours) => {
  if (domain === null) {
    return null
  }
  let realInterval = Number(dateIntervalHours) + 1
  return `
WITH ci AS (
    SELECT min(sub.CERTIFICATE_ID) ID,
           min(sub.ISSUER_CA_ID) ISSUER_CA_ID,
           sub.CERTIFICATE CERTIFICATE
        FROM (SELECT cai.*
                  FROM certificate_and_identities cai
                  WHERE plainto_tsquery('certwatch', '${domain}') @@ identities(cai.CERTIFICATE)
                  AND cai.NAME_VALUE ILIKE ('%' || '${domain}' || '%')
                  AND coalesce(x509_notBefore(cai.CERTIFICATE), 'infinity'::timestamp) >= date_trunc('year', now()  AT TIME ZONE 'UTC' - INTERVAL '${realInterval} hours')
                  AND cai.ISSUER_CA_ID IN (183267, 183283, 183268, 183284, 295810, 295819, 295814, 295815)
                  LIMIT 10000
             ) sub
        GROUP BY sub.CERTIFICATE
)
SELECT ci.ID crtsh_id,
       ci.CERTIFICATE pem
    FROM ci
            LEFT JOIN LATERAL (
                SELECT min(ctle.ENTRY_TIMESTAMP) ENTRY_TIMESTAMP
                    FROM ct_log_entry ctle
                    WHERE ctle.CERTIFICATE_ID = ci.ID
            ) le ON TRUE,
         ca
    WHERE ci.ISSUER_CA_ID = ca.ID
    AND x509_notBefore(ci.CERTIFICATE) >= now() AT TIME ZONE 'UTC' - INTERVAL '${realInterval} hours'
    ORDER BY x509_notBefore(ci.CERTIFICATE) DESC;
    `
}

const doQuery = async (query, registeredDomain) => {
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
  // Track the earliest certificate per name (to calculate Duplicate Certificate rate limit drop-off)
  const firstCertByName = {}
  // Track total certs for Registered Domain within 7 days
  const weekAgo = moment().subtract(7, 'day')
  let totalWithinWeek = 0
  // Post-process the results
  response.data.results = response.data.results || []
  for (let i = 0; i < response.data.results.length; i++) {
    try {
      const cert = new X509()
      const hexBytes = rstrtohex(atob(response.data.results[i].pem))
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
        all_names: cert.getExtSubjectAltName2().map((v) => v[1]),
        not_before: zulutodate(cert.getNotBefore()),
        not_after: zulutodate(cert.getNotAfter()),
        cert_type: isPrecert ? 'Pre-Certificate' : 'Certificate',
        serial,
        pem: KJUR.asn1.ASN1Util.getPEMStringFromHex(hexBytes, 'CERTIFICATE')
      }
      entry.is_within_week = moment(entry.not_before).isAfter(weekAgo)

      // The certificate needs to list at least one domain that is part of
      // the registered domain we're looking at
      if (registeredDomain) {
        let found = false
        for (let i = 0; i < entry.all_names.length; i++) {
          let name = entry.all_names[i]
          if (name.indexOf('*.') === 0) {
            name = name.substring(2)
          }
          const parsed = psl.parse(name)
          if (parsed.domain === registeredDomain) {
            found = true
            break
          }
        }
        if (!found) {
          continue
        }
      }

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

    if (
      final[i].is_within_week &&
      (typeof firstCertByName[namesKey] === 'undefined' ||
        firstCertByName[namesKey].not_before > final[i].not_before)
    ) {
      firstCertByName[namesKey] = final[i]
    }
  }
  response.data.results = final
  response.data.totalWithinWeek = totalWithinWeek
  response.data.groupByNames = groupByNames
  response.data.groupBySerial = groupBySerial
  response.data.firstCertByName = firstCertByName

  return response.data
}

export default {
  data: function () {
    return {
      error: null,
      response: null,
      loading: false,
      query: null,
      dateIntervalHours: 168,
      searchMode: 'domain',
      searchedMode: null,
      selectedCert: null,
      psl: null,
      useLocalTZ: false
    }
  },
  methods: {
    navigateSearch: function () {
      this.$router.push({
        name: 'cert-search',
        query: { m: this.searchMode, q: this.query, d: this.dateIntervalHours }
      })
      this.reload()
    },
    search: async function () {
      if (this.loading) {
        return
      }
      this.error = null
      this.response = null
      this.searchedMode = null
      this.psl = null
      this.loading = true

      let query = this.query
      try {
        let queryFunc = null
        switch (this.searchMode) {
          case 'domain': {
            queryFunc = createDomainQuery
            const parsed = psl.parse(this.query.trim())
            if (!parsed.listed || parsed.domain === null) {
              window.alert(
                `${parsed.input} does not have a Public Suffix or is a Public Suffix itself.`
              )
              query = null
            } else {
              this.psl = parsed
              // We override the query to the Registered Domain
              query = this.psl.domain
            }
            break
          }
          case 'sql':
            queryFunc = () => this.query
            break
        }
        this.response = await doQuery(
          queryFunc(query, this.dateIntervalHours),
          this.registeredDomain
        )
        this.searchedMode = this.searchMode
      } catch (e) {
        this.error = e && e.response && e.response.data ? e.response.data : e
      }
      this.loading = false
    },
    formatDate: function (d) {
      d = moment(d).tz(this.useLocalTZ ? moment.tz.guess() : 'UTC')
      return d.format('DD MMM YYYY HH:mm:ss zz')
    },
    formatDateTitle: function (d) {
      return moment(d).fromNow()
    },
    formatDateTitleWithPrefix: function (d) {
      let date = moment(d)
      let prefix = date.isAfter(moment()) ? 'Expires in ' : 'Expired '
      return prefix + moment(d).fromNow()
    },
    reload: function () {
      if (this.query) {
        this.search()
      }
    },
    addWeek: function (d) {
      return moment(d).add(7, 'day')
    },
    copySummary: function () {
      let regSummary = `OK (${this.response.totalWithinWeek} / ${CERTS_PER_REG_DOMAIN_PER_WEEK} this week.)`
      if (this.response.totalWithinWeek >= CERTS_PER_REG_DOMAIN_PER_WEEK) {
        regSummary = `Limit exceeded (${
          this.response.totalWithinWeek
        }/${CERTS_PER_REG_DOMAIN_PER_WEEK} this week). Next certificate issuable at \
${this.formatDate(this.nextIssuableDate)}.`
      }
      let summary = `\
| Rate Limit                                     | Current Status | Domain           |
|------------------------------------------------|----------------|------------------|
| ${CERTS_PER_REG_DOMAIN_PER_WEEK} Certificates per Registered Domain per week | ${regSummary}  | ${this.registeredDomain} |`
      for (let names in this.response.groupByNames) {
        if (this.response.groupByNames[names].length < 5) {
          continue
        }
        summary += `\n\
| 5 Duplicate Certificates per week | Limit exceeded. Next issuable at \
${this.formatDate(this.addWeek(this.response.firstCertByName[names].not_before))} | ${names} |`
      }
      summary += `\n*Summary generated at ${window.location.href} .*`

      const copyEl = document.createElement('textarea')
      copyEl.value = summary
      document.body.appendChild(copyEl)
      copyEl.select()
      document.execCommand('copy')
      copyEl.remove()
    },
    getSPKIHash: function (cert) {
      return KJUR.crypto.Util.hashHex(cert.getPublicKeyHex(), 'sha256')
    },
    getCertHash: function (cert) {
      return KJUR.crypto.Util.hashHex(cert.hex, 'sha256')
    }
  },
  computed: {
    CERTS_PER_REG_DOMAIN_PER_WEEK: function () {
      return CERTS_PER_REG_DOMAIN_PER_WEEK
    },
    sortedResults: function () {
      if (!this.response || !this.response.results) {
        return []
      }
      return this.response.results
    },
    haveResults: function () {
      return !this.loading && this.response && typeof this.response.totalWithinWeek !== 'undefined'
    },
    searchPlaceholder: function () {
      switch (this.searchMode) {
        case 'domain':
          return 'ASCII-encoded domain name'
        case 'sql':
          return `e.g. select c.id as crtsh_id, c.CERTIFICATE as der from certificate \
c where x509_subjectKeyIdentifier(c.CERTIFICATE) = decode('deadf00d','hex')`
        default:
          throw new Error('Invalid search mode')
      }
    },
    registeredDomain: function () {
      if (this.psl && this.psl.domain) {
        return this.psl.domain
      }
      return null
    },
    nextIssuableDate: function () {
      if (this.response.totalWithinWeek < CERTS_PER_REG_DOMAIN_PER_WEEK) {
        return new Date()
      }
      return this.addWeek(this.sortedResults[CERTS_PER_REG_DOMAIN_PER_WEEK - 1].not_before)
    }
  },
  mounted: function () {
    this.$refs.search.focus()
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
    this.reload()
  },
  created: function () {
    // For relative date strings, show hours up to 2 days, days upto 90 days
    moment.relativeTimeThreshold('m', 60)
    moment.relativeTimeThreshold('h', 24 * 2)
    moment.relativeTimeThreshold('d', 90)

    this.reload()
  }
}
</script>

<style lang="scss" scoped>
@use "sass:color";

.results {
  width: 100%;
  margin-bottom: 2rem;

  th {
    background: #2c3c69;
    color: white;
  }

  th,
  td {
    padding: 0.5rem 1rem;
  }

  tr:nth-child(odd):not(.cert-detail) {
    background: whitesmoke;

    &.within-week {
      background: color.mix(whitesmoke, green, 95%);
    }
  }

  tr {
    &.within-week {
      background: color.mix(whitesmoke, lightgreen, 95%);
    }

    &.cert-detail {
      background: color.mix(whitesmoke, #2c3c69, 95%);

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
      content: '...';
    }
  }

  .expiry,
  .rate-limit-note {
    font-size: 0.8rem;

    &.bad {
      color: red;
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

  input,
  select {
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

.next-issue-date {
  font-size: 0.8rem;
}

.fake-link {
  font-size: 0.8rem;
  text-decoration: underline;
  cursor: pointer;
  color: color.mix(whitesmoke, #2c3c69, 25%);
  user-select: none;
}

.error {
  margin: 1rem 0;
  padding: 1rem;
  background: #ffb6c199;
  border-radius: 5px;
}

.rate-limit-title {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
</style>