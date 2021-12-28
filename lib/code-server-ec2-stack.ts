import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as fs from "fs";

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
        ec2.InstanceSize.MICRO
      ),
      securityGroup: secGrp,
    });

    const userData = fs.readFileSync("scripts/launch-code-server.sh", "utf-8");
    instance.addUserData(userData);
    instance.instance.addPropertyOverride("KeyName", "maze-monorepo");
  }
}
