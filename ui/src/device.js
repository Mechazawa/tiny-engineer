export const device = {
  provisioning: false,
  wifiConfigured: false,
  get inSetup() {
    return this.provisioning || !this.wifiConfigured;
  },
};
