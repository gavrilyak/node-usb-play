function b(a){
  return Promise.resolve(a)
}

async function c(a){
  await someUnexisting();
  return 42+a;
}

async function test(a){
  let res;
  if(a)
    res = await b(a)
  else
    res=  await c(a)
  return res;
}

async function main(){
  const res1 = await test(1);
  console.log("test 1 returned", res1);
  const res0 = await test(0);
  console.log("test 0 returned", res0);
}

main(1).catch(e=>console.error(e.stack))
