import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
// import * as fs from "fs";

export class CodeServerEc2Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 1,
      cidr: "10.0.0.0/21",
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: "subnetPub",
          cidrMask: 24,
        },
      ],
    });

    const secGrp = new ec2.SecurityGroup(this, "CsSg", {
      vpc: vpc,
      securityGroupName: "csSg",
      description: "Allow HTTP traffic to EC2 instance from anywhere",
      allowAllOutbound: true,
    });

    secGrp.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8080), // Code-Server listen on 8080 port
      "Allow ingress HTTP traffic"
    );
    secGrp.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow ingress SSH traffic"
    );

    // https://cloud-images.ubuntu.com/locator/ec2/
    // owner: 099720109477 (ubuntu)
    const imgLinuxUbu = new ec2.GenericLinuxImage({
      "eu-central-1": "ami-0d527b8c289b4af7f", //  Ubuntu Server 20.04 LTS amd64
    });

    const instance = new ec2.Instance(this, "CsEc2Instance", {
      vpc: vpc,
      machineImage: imgLinuxUbu,
      instanceName: "code-server-ec2",
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MEDIUM
      ),
      securityGroup: secGrp,
    });

    // const userData = fs.readFileSync("scripts/launch-code-server.sh", "utf-8");
    // https://github.com/coder/deploy-code-server/blob/main/deploy-vm/launch-code-server.sh
    instance.addUserData(`#!/bin/sh

# install code-server service system-wide
export HOME=/root
curl -fsSL https://code-server.dev/install.sh | sh

# add our helper server to redirect to the proper URL for --link
git clone https://github.com/bpmct/coder-cloud-redirect-server
cd coder-cloud-redirect-server
cp coder-cloud-redirect.service /etc/systemd/system/
cp coder-cloud-redirect.py /usr/bin/

# create a code-server user
adduser --disabled-password --gecos "" coder
echo "coder ALL=(ALL:ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/coder
usermod -aG sudo coder

# copy ssh keys from root
cp -r /root/.ssh /home/coder/.ssh
chown -R coder:coder /home/coder/.ssh

# configure code-server to use --link with the "coder" user
mkdir -p /home/coder/.config/code-server
touch /home/coder/.config/code-server/config.yaml
echo "link: true" > /home/coder/.config/code-server/config.yaml
chown -R coder:coder /home/coder/.config

# start and enable code-server and our helper service
systemctl enable --now code-server@coder
systemctl enable --now coder-cloud-redirect`);
    instance.instance.addPropertyOverride("KeyName", "almas-macbook-pro-2020");
  }
}
