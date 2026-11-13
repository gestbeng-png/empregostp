// Os headers também abrangem o JSON de getServerSideProps em /_next/data.
export function setPrivatePageHeaders(context) {
  context?.res?.setHeader('Cache-Control', 'private, no-store, max-age=0');
}
