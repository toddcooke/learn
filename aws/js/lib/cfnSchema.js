// aws/js/lib/cfnSchema.js
//
// Data catalog for the CloudFormation subset the Architecture Challenge
// simulates: supported resource types, their properties (required flags,
// value checks, which resource kind a ref-shaped property must point at)
// and short SAA-C03-study hover docs. cfnCompile.js consumes the shapes;
// cfn-editor.js consumes the docs and completion lists. Pure data + tiny
// lookups — no YAML, no DOM.

export const KIND_LABELS = {
  vpc: 'a VPC',
  subnet: 'a subnet',
  igw: 'an internet gateway',
  igwAttachment: 'a gateway attachment',
  eip: 'an Elastic IP',
  nat: 'a NAT gateway',
  rtb: 'a route table',
  route: 'a route',
  assoc: 'a route table association',
  sg: 'a security group',
  dbsubnetgroup: 'a DB subnet group',
  workload: 'a workload',
};

export const ENGINE_DEFAULT_PORTS = { postgres: 5432, mysql: 3306, mariadb: 3306 };

// Real AWS resource types this simulator deliberately does not model.
// Compile treats them as a warning (resource ignored), never the
// unknown-type error — misspellings must stay loud.
export const KNOWN_UNSUPPORTED = [
  'AWS::S3::Bucket', 'AWS::Lambda::Function', 'AWS::DynamoDB::Table',
  'AWS::IAM::Role', 'AWS::IAM::InstanceProfile', 'AWS::SNS::Topic',
  'AWS::SQS::Queue', 'AWS::CloudWatch::Alarm',
  'AWS::AutoScaling::AutoScalingGroup', 'AWS::EC2::LaunchTemplate',
  'AWS::EC2::VPCEndpoint', 'AWS::EC2::NetworkAcl', 'AWS::EC2::NetworkAclEntry',
  'AWS::EC2::SubnetNetworkAclAssociation', 'AWS::EC2::SecurityGroupIngress',
  'AWS::EC2::SecurityGroupEgress', 'AWS::EC2::EIPAssociation',
  'AWS::EC2::FlowLog', 'AWS::ElasticLoadBalancingV2::Listener',
  'AWS::ElasticLoadBalancingV2::TargetGroup', 'AWS::RDS::DBParameterGroup',
  'AWS::CloudFront::Distribution', 'AWS::Route53::RecordSet',
  'AWS::CertificateManager::Certificate',
];

// Resource-level attribute keys (the siblings of Type/Properties). Shared
// by cfnCompile's unknown-attribute warning and the editor's completion at
// the attribute indent level.
export const RESOURCE_ATTRIBUTES = ['Type', 'Properties', 'DependsOn', 'Condition', 'Metadata', 'DeletionPolicy', 'UpdateReplacePolicy'];

// Prop spec fields: required (bool), check ('cidr'|'az'|'bool'|'port'|
// 'string'|'tags'|'ingress'), ref/refList (kind the !Ref must target),
// getAtt ({kind, attr}), enum (allowed scalars), ignored (accepted, not
// simulated — compile skips validation beyond presence), doc.
export const RESOURCE_TYPES = {
  'AWS::EC2::VPC': {
    kind: 'vpc',
    max: 1,
    doc: 'A virtual network: an isolated IPv4 address space (/16–/28) that all '
      + 'other resources live inside. This simulator models exactly one VPC.',
    props: {
      CidrBlock: {
        required: true, check: 'cidr',
        doc: `The VPC's IPv4 range in CIDR notation, /16 (65,536 addresses) `
          + 'through /28 (16 addresses). Subnets must fit inside it.',
      },
      EnableDnsSupport: { ignored: true, doc: 'Accepted; DNS is not simulated.' },
      EnableDnsHostnames: { ignored: true, doc: 'Accepted; DNS is not simulated.' },
      InstanceTenancy: { ignored: true, doc: 'Accepted; tenancy is not simulated.' },
      Tags: { check: 'tags', doc: 'Key/Value metadata. A Name tag labels the VPC.' },
    },
  },
  'AWS::EC2::Subnet': {
    kind: 'subnet',
    doc: `A slice of the VPC's address range pinned to one Availability Zone. `
      + '"Public" is not a property — a subnet is public when its route table '
      + 'sends 0.0.0.0/0 to an internet gateway.',
    props: {
      VpcId: { required: true, ref: 'vpc', doc: '!Ref to the VPC this subnet belongs to.' },
      CidrBlock: {
        required: true, check: 'cidr',
        doc: `The subnet's IPv4 range; must sit inside the VPC CIDR and not `
          + 'overlap other subnets. AWS reserves 5 addresses in every subnet.',
      },
      AvailabilityZone: {
        required: true, check: 'az',
        doc: 'Full AZ name, e.g. us-east-1a. This simulator models three AZs: '
          + 'the trailing letter must be a, b, or c.',
      },
      MapPublicIpOnLaunch: {
        check: 'bool',
        doc: 'When true, EC2 instances launched in this subnet get a public IP. '
          + 'This is the real-CFN way to give an instance a public address.',
      },
      Tags: { check: 'tags', doc: 'A Name tag names the subnet on the diagram.' },
    },
  },
  'AWS::EC2::InternetGateway': {
    kind: 'igw',
    max: 1,
    doc: `The VPC's door to the internet. Declaring it does nothing until an `
      + 'AWS::EC2::VPCGatewayAttachment attaches it to the VPC.',
    props: {
      Tags: { check: 'tags', doc: 'Key/Value metadata.' },
    },
  },
  'AWS::EC2::VPCGatewayAttachment': {
    kind: 'igwAttachment',
    max: 1,
    doc: 'Attaches an internet gateway to a VPC. Without this resource the IGW '
      + 'exists but passes no traffic — a classic exam gotcha.',
    props: {
      VpcId: { required: true, ref: 'vpc', doc: '!Ref to the VPC.' },
      InternetGatewayId: { required: true, ref: 'igw', doc: '!Ref to the internet gateway.' },
    },
  },
  'AWS::EC2::EIP': {
    kind: 'eip',
    doc: `A static public IPv4 address. NAT gateways require one, wired via `
      + '!GetAtt <EIP>.AllocationId.',
    props: {
      Domain: { enum: ['vpc'], doc: 'Always vpc for VPC use.' },
      Tags: { check: 'tags', doc: 'Key/Value metadata.' },
    },
  },
  'AWS::EC2::NatGateway': {
    kind: 'nat',
    doc: `Outbound-only internet access for private subnets. Must itself sit in `
      + 'a PUBLIC subnet and needs an Elastic IP allocation.',
    props: {
      SubnetId: {
        required: true, ref: 'subnet',
        doc: `!Ref to the subnet hosting the NAT gateway — a public subnet, or `
          + 'the NAT cannot reach the internet either.',
      },
      AllocationId: {
        required: true, getAtt: { kind: 'eip', attr: 'AllocationId' },
        doc: `!GetAtt <EIP logical id>.AllocationId — the Elastic IP this NAT `
          + 'gateway presents to the internet.',
      },
      ConnectivityType: { ignored: true, doc: 'Accepted; only public NAT gateways are simulated.' },
      Tags: { check: 'tags', doc: 'Key/Value metadata.' },
    },
  },
  'AWS::EC2::RouteTable': {
    kind: 'rtb',
    doc: 'A set of routes. Subnets bind to it via '
      + 'AWS::EC2::SubnetRouteTableAssociation; unassociated subnets use the '
      + `VPC's implicit main table (local-only here).`,
    props: {
      VpcId: { required: true, ref: 'vpc', doc: '!Ref to the VPC.' },
      Tags: { check: 'tags', doc: 'A Name tag names the table on subnet cards.' },
    },
  },
  'AWS::EC2::Route': {
    kind: 'route',
    doc: 'One route in a route table: a destination CIDR plus exactly one '
      + 'target (GatewayId for an IGW, NatGatewayId for a NAT). The local '
      + 'route inside the VPC is implicit.',
    props: {
      RouteTableId: { required: true, ref: 'rtb', doc: '!Ref to the owning route table.' },
      DestinationCidrBlock: {
        required: true, check: 'cidr',
        doc: 'Traffic matching this CIDR uses this route; 0.0.0.0/0 means '
          + '"everything not matched by a more specific route".',
      },
      GatewayId: { ref: 'igw', doc: '!Ref to the internet gateway (public-subnet routes).' },
      NatGatewayId: { ref: 'nat', doc: '!Ref to a NAT gateway (private-subnet egress).' },
    },
  },
  'AWS::EC2::SubnetRouteTableAssociation': {
    kind: 'assoc',
    doc: 'Binds one subnet to one route table. A subnet can have at most one '
      + 'association; without one it falls back to the implicit main table.',
    props: {
      SubnetId: { required: true, ref: 'subnet', doc: '!Ref to the subnet.' },
      RouteTableId: { required: true, ref: 'rtb', doc: '!Ref to the route table.' },
    },
  },
  'AWS::EC2::SecurityGroup': {
    kind: 'sg',
    doc: 'A stateful instance-level firewall. This simulator models inbound '
      + 'rules only; outbound is treated as allow-all.',
    props: {
      GroupDescription: {
        required: true, check: 'string',
        doc: 'Required by real CloudFormation — a human description of the group.',
      },
      VpcId: { required: true, ref: 'vpc', doc: '!Ref to the VPC.' },
      GroupName: { check: 'string', doc: 'Optional display name; defaults to the logical id.' },
      SecurityGroupIngress: {
        check: 'ingress',
        doc: 'Inbound rules: each needs IpProtocol (tcp/udp/icmp/-1), '
          + 'FromPort/ToPort for tcp/udp, and exactly one source — CidrIp or '
          + 'SourceSecurityGroupId (!Ref to another SG; the least-privilege choice).',
      },
      SecurityGroupEgress: { ignored: true, doc: 'Accepted; outbound is not simulated (allow-all).' },
      Tags: { check: 'tags', doc: 'Key/Value metadata.' },
    },
  },
  'AWS::EC2::Instance': {
    kind: 'workload',
    workloadType: 'ec2',
    doc: `An EC2 instance. Give it a role via Tags (Key: Role) to bind it to `
      + `the challenge's roles; its listening port defaults to 80 `
      + '(override with a Port tag).',
    props: {
      ImageId: {
        required: true, check: 'string',
        doc: 'Required by real CloudFormation. Any AMI id string is accepted here.',
      },
      SubnetId: { required: true, ref: 'subnet', doc: `!Ref to the instance's subnet.` },
      InstanceType: { ignored: true, doc: 'Accepted; instance size is not simulated.' },
      SecurityGroupIds: { refList: 'sg', doc: 'List of !Ref security groups.' },
      Tags: {
        check: 'tags',
        doc: 'Name names the instance; Role assigns a challenge role; Port '
          + 'overrides the listening port (default 80).',
      },
    },
  },
  'AWS::ElasticLoadBalancingV2::LoadBalancer': {
    kind: 'workload',
    workloadType: 'alb',
    doc: 'An Application Load Balancer. Needs subnets in at least two AZs; '
      + 'Scheme internet-facing (the default) exposes it to the internet. '
      + 'Listening port defaults to 80 (override with a Port tag).',
    props: {
      Subnets: {
        required: true, refList: 'subnet',
        doc: 'List of !Ref subnets — at least two, in different AZs, all public '
          + 'for an internet-facing ALB.',
      },
      SecurityGroups: { refList: 'sg', doc: 'List of !Ref security groups.' },
      Scheme: {
        enum: ['internet-facing', 'internal'],
        doc: 'internet-facing (default) serves the internet; internal serves '
          + 'only the VPC.',
      },
      Type: { enum: ['application'], doc: 'Only Application Load Balancers are simulated.' },
      Tags: { check: 'tags', doc: 'Name/Role/Port, as on AWS::EC2::Instance.' },
      Name: { ignored: true, doc: 'Accepted; the diagram names ALBs from the Name tag or logical id.' },
      IpAddressType: { ignored: true, doc: 'Accepted; only IPv4 is simulated.' },
      SubnetMappings: { ignored: true, doc: 'Accepted; use Subnets in this simulator — mappings are not simulated.' },
      LoadBalancerAttributes: { ignored: true, doc: 'Accepted; attributes are not simulated.' },
      EnforceSecurityGroupInboundRulesOnPrivateLinkTraffic: { ignored: true, doc: 'Accepted; PrivateLink is not simulated.' },
      MinimumLoadBalancerCapacity: { ignored: true, doc: 'Accepted; capacity is not simulated.' },
      EnablePrefixForIpv6SourceNat: { ignored: true, doc: 'Accepted; IPv6 is not simulated.' },
      Ipv4IpamPoolId: { ignored: true, doc: 'Accepted; IPAM is not simulated.' },
      EnableCapacityReservationProvisionStabilize: { ignored: true, doc: 'Accepted; not simulated.' },
    },
  },
  'AWS::RDS::DBSubnetGroup': {
    kind: 'dbsubnetgroup',
    doc: 'The set of subnets a DB instance may occupy — at least two, across '
      + 'two AZs, and (best practice) all private.',
    props: {
      DBSubnetGroupDescription: { required: true, check: 'string', doc: 'Required human description.' },
      SubnetIds: { required: true, refList: 'subnet', doc: 'List of !Ref subnets.' },
      Tags: { check: 'tags', doc: 'Key/Value metadata.' },
    },
  },
  'AWS::RDS::DBInstance': {
    kind: 'workload',
    workloadType: 'rds',
    doc: 'A managed relational database. Lives in a DB subnet group; MultiAZ '
      + 'true keeps a standby in a second AZ. Port defaults from Engine '
      + '(postgres 5432, mysql/mariadb 3306).',
    props: {
      Engine: {
        required: true, enum: ['postgres', 'mysql', 'mariadb'],
        doc: 'Database engine; sets the default port (postgres 5432, mysql/mariadb 3306).',
      },
      DBSubnetGroupName: { required: true, ref: 'dbsubnetgroup', doc: '!Ref to the DB subnet group.' },
      VPCSecurityGroups: { refList: 'sg', doc: 'List of !Ref security groups.' },
      MultiAZ: { check: 'bool', doc: 'true keeps a synchronous standby in another AZ.' },
      Port: { check: 'port', doc: 'Listening port; defaults from Engine.' },
      DBInstanceClass: { ignored: true, doc: 'Accepted; instance size is not simulated.' },
      AllocatedStorage: { ignored: true, doc: 'Accepted; storage is not simulated.' },
      MasterUsername: { ignored: true, doc: 'Accepted; credentials are not simulated.' },
      MasterUserPassword: { ignored: true, doc: 'Accepted; credentials are not simulated.' },
      Tags: { check: 'tags', doc: 'Name names the database; Role assigns a challenge role.' },
    },
  },
};

export function typeDoc(typeName) {
  return RESOURCE_TYPES[typeName] ? RESOURCE_TYPES[typeName].doc : null;
}

export function propDoc(typeName, prop) {
  const spec = RESOURCE_TYPES[typeName];
  return spec && spec.props[prop] && spec.props[prop].doc ? spec.props[prop].doc : null;
}
