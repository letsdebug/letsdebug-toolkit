<template>
  <div id="app">
    <div id="nav">
      <router-link to="/" exact>Home</router-link> |
      <router-link to="/about">About</router-link> |
      <router-link :to="{ name: 'clear-authz'}">clear-authz</router-link> |
      <router-link :to="{ name: 'cert-revoke'}">cert-revoke</router-link> |
      <router-link :to="{ name: 'cert-search'}">cert-search</router-link>
    </div>
    <h1>Let's Debug Toolkit</h1>
    <router-view/>
  </div>
</template>

<style lang="scss" scoped>
</style>
