declare module '*.vue' {
  const component: import('vue').Component<
    any,
    any,
    any,
    import('vue').ComputedOptions,
    import('vue').MethodOptions,
    {},
    any
  >
  export default component
}
