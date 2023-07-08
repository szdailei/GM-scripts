#!/usr/bin/env node

import psList from 'ps-list';
import shell from 'shelljs';

async function main() {
  const options = { all: false };
  const items = await psList(options);
  let pid;
  items.forEach((item) => {
    if (item.name === 'clash.meta') {
      if (item.cmd.indexOf('/home/dailei/.config/clash-proxy') !== -1) {
        pid = item.pid;
      }
    }
  });

  if (!pid) {
    shell.echo("Warn: Clash isn't running");
  } else {
    if (shell.exec(`kill ${pid}`).code !== 0) {
      shell.echo(`Error: Kill clash process of ${pid} failed`);
      shell.exit(1);
    } else {
      shell.echo(`Kill clash process successed, pid = ${pid}`);
    }
  }

  shell.echo(`Starting clash ......`);
  if (shell.exec('/usr/bin/clash.meta -d /home/dailei/.config/clash-proxy').code !== 0) {
    shell.echo('Error: Restart clash failed');
    shell.exit(1);
  }
}

main();
