FROM quay.io/axiom-md/axiom:latest

LABEL version="4.1"
RUN git clone https://github.com/itsdevmj/axiom.git /root/Axiom
WORKDIR /root/Axiom
RUN rm -rf node_modules yarn.lock
RUN yarn install --network-concurrency 1
CMD ["node", "index.js"]
