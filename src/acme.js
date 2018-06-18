import axios from 'axios'
import { KJUR, KEYUTIL } from 'jsrsasign'

// Not permitted for CORS in Boulder v1 WFE
delete axios.defaults.headers.common['content-type']

const clients = {}

const keyAlg = function (pk) {
  switch (pk['kty']) {
    case 'RSA':
      return 'RS256'
  }
  return null
}

const pubKey = function (pk) {
  switch (pk['kty']) {
    case 'RSA':
      return { e: pk.e, kty: pk.kty, n: pk.n }
  }
  return null
}

const keyAuth = function (pk, token) {
  const thumbprint = KJUR.jws.JWS.getJWKthumbprint(pk)
  return `${token}.${thumbprint}`
}

const getClient = (privateKey, hostname) => {
  if (typeof clients[hostname] !== 'undefined') {
    return clients[hostname]
  }
  let newClient = null
  if (hostname.indexOf('-v02') !== -1) {
    newClient = new V2Client(privateKey, hostname)
  } else {
    newClient = new V1Client(privateKey, hostname)
  }
  clients[hostname] = newClient
  return newClient
}

class V1Client {
  constructor (privateKey, hostname) {
    const parsedKey = JSON.parse(privateKey)
    this.pub = pubKey(parsedKey)
    this.pk = KEYUTIL.getKey(parsedKey)
    this.hostname = hostname
    this.nonces = []
    this.directory = null
  }

  async respondChallenge (challURL) {
    const chall = await axios.get(challURL)
    const keyAuthz = keyAuth(this.pub, chall.data.token)
    return this.post(challURL, {
      'type': 'http-01',
      'keyAuthorization': keyAuthz,
      'resource': 'challenge'
    })
  }

  async post (url, payload) {
    const body = await this.sign(url, payload)
    const result = await axios({
      method: 'POST',
      url: url,
      data: JSON.stringify(body) /* to prevent content-type being sent */
    })
    const nonce = result.headers['replay-nonce']
    if (nonce) {
      this.nonces.push(nonce)
    }
    return result
  }

  async sign (url, payload) {
    const nonce = await this.nonce()
    const algo = keyAlg(this.pub)
    let header = {
      'alg': algo,
      'nonce': nonce,
      'url': url,
      'jwk': this.pub
    }

    const sig = KJUR.jws.JWS.sign(algo, header, payload, this.pk).split('.')
    return {
      protected: sig[0],
      payload: sig[1],
      signature: sig[2]
    }
  }

  async nonce () {
    if (this.nonces.length === 0) {
      await this.fetchDirectory()
    }
    return this.nonces.pop()
  }

  async fetchDirectory () {
    const result = await axios.get(`https://${this.hostname}/directory`)
    this.directory = result.data
    const nonce = result.headers['replay-nonce']
    if (nonce) {
      this.nonces.push(nonce)
    }
  }
}

class V2Client {
  constructor (privateKey, hostname) {
    const parsedKey = JSON.parse(privateKey)
    this.pub = pubKey(parsedKey)
    this.pk = KEYUTIL.getKey(parsedKey)
    this.hostname = hostname
    this.nonces = []
    this.directory = null
    this.accountID = null
  }

  async respondChallenge (challURL) {
    return this.post(challURL, {})
  }

  async fetchAccount () {
    const body = await this.sign(this.directory['newAccount'], null, {
      termsOfServiceAgreed: true,
      onlyReturnExisting: true
    })
    const result = await axios({
      method: 'POST',
      url: this.directory['newAccount'],
      headers: {
        'content-type': 'application/jose+json'
      },
      data: body
    })
    this.accountID = result.headers['location']
    const nonce = result.headers['replay-nonce']
    if (nonce) {
      this.nonces.push(nonce)
    }
  }

  async fetchDirectory () {
    const result = await axios.get(`https://${this.hostname}/directory`)
    this.directory = result.data
  }

  async post (url, payload) {
    if (this.directory === null) {
      await this.fetchDirectory()
    }
    if (this.accountID === null) {
      await this.fetchAccount()
    }
    const body = await this.sign(url, this.accountID, payload)
    const result = await axios({
      method: 'POST',
      url: `${url}`,
      headers: {
        'content-type': 'application/jose+json'
      },
      data: body
    })
    const nonce = result.headers['replay-nonce']
    if (nonce) {
      this.nonces.push(nonce)
    }
    return result
  }

  async sign (url, keyID, payload) {
    const nonce = await this.nonce()
    const algo = keyAlg(this.pub)
    let header = {
      'alg': algo,
      'nonce': nonce,
      'url': `${url}`
    }
    if (keyID) {
      header['kid'] = keyID
    } else {
      header['jwk'] = this.pub
    }

    const sig = KJUR.jws.JWS.sign(algo, header, payload, this.pk).split('.')
    return {
      protected: sig[0],
      payload: sig[1],
      signature: sig[2]
    }
  }

  async nonce () {
    if (this.nonces.length === 0) {
      const result = await axios.head(this.directory['newNonce'])
      this.nonces.push(result.headers['replay-nonce'])
    }
    return this.nonces.pop()
  }
}

export default getClient
