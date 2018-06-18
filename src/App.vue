<template>
  <div id="app">
    <div id="nav">
      <router-link to="/">Home</router-link> |
      <router-link to="/about">About</router-link> |
      <router-link :to="{ name: 'clear-authz'}">clear-authz</router-link>
    </div>
    <h1>Let's Debug Toolkit</h1>
    <router-view/>
  </div>
</template>

<style lang="scss" scoped>
a.router-link-active {
  color: #333;
}
</style>
