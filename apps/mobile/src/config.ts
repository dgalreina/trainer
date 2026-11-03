// Valores públicos (no son secretos): identifican el backend y el user pool.
// Se pueden sobrescribir con variables EXPO_PUBLIC_* para otro entorno.
export const config = {
  apiUrl:
    process.env.EXPO_PUBLIC_API_URL ??
    'https://nkqhn5ykg8.execute-api.eu-west-1.amazonaws.com',
  cognito: {
    region: process.env.EXPO_PUBLIC_COGNITO_REGION ?? 'eu-west-1',
    clientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? '29oe7bgkhb9bo5b0i3b91fbl6d',
  },
};
