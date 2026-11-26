/** Pilot deployment hardening. No credentials are stored in source. */
const nextConfig={
 reactStrictMode:true,
 output:'standalone',
 async headers(){
  return [{
   source:'/:path*',
   headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'X-Frame-Options',value:'DENY'},
    // Pilot must not be indexed before the formal school launch.
    {key:'X-Robots-Tag',value:'noindex, nofollow'}
   ]
  }]
 }
};
export default nextConfig;
