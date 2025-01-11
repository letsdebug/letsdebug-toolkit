<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div id="app">
    <div id="nav">
      <RouterLink to="/">Home</RouterLink> | <RouterLink to="/about">About</RouterLink> |
      <RouterLink to="/clear-authz">clear-authz</RouterLink> |
      <RouterLink to="/cert-revoke">cert-revoke</RouterLink> |
      <RouterLink to="/cert-search">cert-search</RouterLink>
    </div>
    <h1>Let's Debug Toolkit</h1>
    <RouterView />
  </div>
</template>

<style lang="scss" scoped>
@use '@/assets/app.scss';
</style>
