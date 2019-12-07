import axios from 'axios'
import { KJUR, KEYUTIL, hextob64u } from 'jsrsasign'

// Not permitted for CORS in Boulder v1 WFE
delete axios.defaults.headers.common['content-type']

const clients = {}

const keyAlg = function (pk) {
  switch (pk.kty) {
    case 'RSA':
      return 'RS256'
    case 'EC':
      return 'ES256'
  }
  return null
}

const pubKey = function (pk) {
  switch (pk.kty) {
    case 'RSA':
      return { e: pk.e, kty: pk.kty, n: pk.n }
    case 'EC':
      return { crv: 'P-256', x: pk.x, y: pk.y, kty: pk.kty }
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
  let newClient = new V2Client(privateKey, hostname)
  clients[hostname] = newClient
  return newClient
}

const newClient = async (hostname) => {
  let priv = null
  if (window && window.localStorage) {
    try {
      const stored = window.localStorage.getItem('letsdebug-account-key')
      if (stored) {
        priv = JSON.parse(stored)
      }
    } catch (e) {
      console.log('LocalStorage error', e)
    }
  }
  if (!priv) {
    const kp = KEYUTIL.generateKeypair('EC', 'secp256r1').prvKeyObj
    const pubCurves = kp.getPublicKeyXYHex()
    priv = {
      kty: kp.type,
      crv: kp.getShortNISTPCurveName(),
      x: hextob64u(pubCurves.x),
      y: hextob64u(pubCurves.y),
      d: hextob64u(kp.prvKeyHex)
    }
    if (window && window.localStorage) {
      try {
        window.localStorage.setItem('letsdebug-account-key', JSON.stringify(priv))
      } catch (e) {
        console.log('LocalStorage error', e)
      }
    }
  }
  const client = new V2Client(priv, hostname)
  await client.fetchAccount(true)
  return client
}

class V2Client {
  constructor (privateKey, hostname) {
    const parsedKey = typeof privateKey === 'string' ? JSON.parse(privateKey) : privateKey
    this.pub = pubKey(parsedKey)
    this.pk = KEYUTIL.getKey(parsedKey)
    this.hostname = hostname
    this.nonces = []
    this.directory = null
    this.accountID = null
  }

  async newOrder (names) {
    if (this.directory === null) {
      await this.fetchDirectory()
    }
    return this.post(this.directory['newOrder'], {
      identifiers: names.map(v => ({
        type: 'dns', value: v
      }))
    })
  }

  async revokeCertificate (certDERAsHex) {
    return this.post(this.directory['revokeCert'], {
      certificate: hextob64u(certDERAsHex)
    })
  }

  async deactivateAuthz (authzURL) {
    return this.post(authzURL, {
      status: 'deactivated'
    })
  }

  async respondChallenge (challURL) {
    return this.post(challURL, {})
  }

  async pollChallenge (challURL) {
    while (true) {
      const chall = await this.postAsGet(challURL)
      if (!chall || !chall.data || !chall.data.status) {
        throw new Error('Unexpected response when polling challenge')
      }
      switch (chall.data.status) {
        case 'invalid':
          throw new Error(`Challenge is invalid (${chall.data.url})`)
        case 'pending':
        case 'processing':
          break
        case 'valid':
          return chall
      }
      await new Promise((resolve) => setTimeout(resolve, 2500))
    }
  }

  async fetchAccount (registerNew = false) {
    if (this.directory === null) {
      await this.fetchDirectory()
    }
    const body = await this.sign(this.directory['newAccount'], null, {
      termsOfServiceAgreed: true,
      onlyReturnExisting: !registerNew
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
      url,
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
    const alg = keyAlg(this.pub)
    let header = {
      alg,
      nonce,
      url
    }
    if (keyID) {
      header.kid = keyID
    } else {
      header.jwk = this.pub
    }

    const sig = KJUR.jws.JWS.sign(alg, header, payload, this.pk).split('.')
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

  async postAsGet (url) {
    return this.post(url, '')
  }

  keyAuthz (token) {
    return keyAuth(this.pub, token)
  }

  dnsKeyAuthz (token) {
    return hextob64u(KJUR.crypto.Util.sha256(this.keyAuthz(token)))
  }
}

export {
  getClient,
  newClient
}
