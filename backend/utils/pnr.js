export function generatePNR() { // PNR = passenger name record (size of 10)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let pnr = '';
  for (let i = 0; i < 10; i += 1) {
    pnr += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return pnr;
}
