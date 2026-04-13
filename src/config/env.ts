type Credentials = { username: string; password: string };

type EnvConfig = {
  mlisPortalUrl: string;
  salesforceLightningUrl: string;
  broker: Credentials;
  salesforce: Credentials;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[env] Missing ${name}. Set it in .env (or export it in your shell).`,
    );
  }
  return value;
}

export function getEnvConfig(): EnvConfig {
  return {
    mlisPortalUrl: required('MLIS_PORTAL_URL'),
    salesforceLightningUrl: required('SALESFORCE_LIGHTNING_URL'),
    broker: {
      username: required('BROKER_USERNAME'),
      password: required('BROKER_PASSWORD'),
    },
    salesforce: {
      username: required('SALESFORCE_USERNAME'),
      password: required('SALESFORCE_PASSWORD'),
    },
  };
}

export function getBrokerCredentials(): Credentials {
  return getEnvConfig().broker;
}

export function getSalesforceCredentials(): Credentials {
  return getEnvConfig().salesforce;
}

export function getMlisPortalUrl(): string {
  return getEnvConfig().mlisPortalUrl;
}

export function getSalesforceLightningUrl(): string {
  return getEnvConfig().salesforceLightningUrl;
}
