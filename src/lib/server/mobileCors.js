const nativeOrigins=new Set(['capacitor://localhost','https://localhost']);
export function mobileOptions(request) {
  const origin=request.headers.get('origin');
  const allowed=nativeOrigins.has(origin) || (process.env.NODE_ENV==='development' && origin==='http://localhost:5173');
  return allowed ? {'Access-Control-Allow-Origin':origin,Vary:'Origin','Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'} : {};
}
export const OPTIONS=request=>new Response(null,{status:204,headers:mobileOptions(request)});
export function withMobileCors(handler) {
  return async (request,context)=>{
    const response=await handler(request,context);
    for(const [key,value] of Object.entries(mobileOptions(request))) response.headers.set(key,value);
    response.headers.set('Cache-Control','no-store');return response;
  };
}
