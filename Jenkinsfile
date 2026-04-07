pipeline {
    agent any

    environment {
        AWS_REGION     = "us-east-1"
        AWS_ACCOUNT_ID = "836548370285"
        ECR_REGISTRY   = "836548370285.dkr.ecr.us-east-1.amazonaws.com"
        ECR_REPO       = "notes-app"
        IMAGE_TAG      = "${env.BUILD_NUMBER}"
    }

    stages {

        // ─── 1. CHECKOUT ────────────────────────────────────────────────
        stage("Checkout") {
            steps {
                checkout scm
            }
        }

        // ─── 2. SONARQUBE ANALYSIS ──────────────────────────────────────
        stage("SonarQube Analysis") {
            steps {
                withCredentials([string(credentialsId: "sonar-token", variable: "SONAR_TOKEN")]) {
                    withSonarQubeEnv("SonarQube") {
                        script {
                            def scannerHome = tool name: "sonar-scanner", type: "hudson.plugins.sonar.SonarRunnerInstallation"
                            sh """
                                ${scannerHome}/bin/sonar-scanner \
                                  -Dsonar.projectKey=notes-app \
                                  -Dsonar.projectName=notes-app \
                                  -Dsonar.sources=. \
                                  -Dsonar.exclusions=**/node_modules/**,**/package-lock.json \
                                  -Dsonar.login=${SONAR_TOKEN}
                            """
                        }
                    }
                }
            }
        }

        // ─── 3. QUALITY GATE ────────────────────────────────────────────
        stage("Quality Gate") {
            steps {
                timeout(time: 5, unit: "MINUTES") {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // ─── 4. BUILD DOCKER IMAGES ─────────────────────────────────────
        stage("Build Docker Images") {
            steps {
                sh """
                    docker build -t ${ECR_REGISTRY}/${ECR_REPO}:api-gateway-${IMAGE_TAG}   ./api-gateway
                    docker build -t ${ECR_REGISTRY}/${ECR_REPO}:user-service-${IMAGE_TAG}  ./user-service
                    docker build -t ${ECR_REGISTRY}/${ECR_REPO}:notes-service-${IMAGE_TAG} ./notes-service
                    docker build -t ${ECR_REGISTRY}/${ECR_REPO}:frontend-${IMAGE_TAG}      ./frontend
                """
            }
        }

        // ─── 5. TRIVY SCAN ──────────────────────────────────────────────
        stage("Trivy Scan") {
            steps {
                sh """
                    trivy image \
                        --exit-code 1 \
                        --severity HIGH,CRITICAL \
                        --no-progress \
                        --skip-files "/app/node_modules" \
                        --vuln-type os \
                        ${ECR_REGISTRY}/${ECR_REPO}:api-gateway-${IMAGE_TAG}

                    trivy image \
                        --exit-code 1 \
                        --severity HIGH,CRITICAL \
                        --no-progress \
                        --skip-files "/app/node_modules" \
                        --vuln-type os \
                        ${ECR_REGISTRY}/${ECR_REPO}:user-service-${IMAGE_TAG}

                    trivy image \
                        --exit-code 1 \
                        --severity HIGH,CRITICAL \
                        --no-progress \
                        --skip-files "/app/node_modules" \
                        --vuln-type os \
                        ${ECR_REGISTRY}/${ECR_REPO}:notes-service-${IMAGE_TAG}

                    trivy image \
                        --exit-code 1 \
                        --severity HIGH,CRITICAL \
                        --no-progress \
                        --vuln-type os \
                        ${ECR_REGISTRY}/${ECR_REPO}:frontend-${IMAGE_TAG}
                """
            }
        }

        // ─── 6. PUSH TO ECR ─────────────────────────────────────────────
        stage("Push to ECR") {
            steps {
                withCredentials([[
                    $class: "AmazonWebServicesCredentialsBinding",
                    credentialsId: "AWS_CREDENTIALS",
                    accessKeyVariable: "AWS_ACCESS_KEY_ID",
                    secretKeyVariable: "AWS_SECRET_ACCESS_KEY"
                ]]) {
                    sh """
                        aws ecr get-login-password --region ${AWS_REGION} \
                            | docker login --username AWS --password-stdin ${ECR_REGISTRY}

                        docker push ${ECR_REGISTRY}/${ECR_REPO}:api-gateway-${IMAGE_TAG}
                        docker push ${ECR_REGISTRY}/${ECR_REPO}:user-service-${IMAGE_TAG}
                        docker push ${ECR_REGISTRY}/${ECR_REPO}:notes-service-${IMAGE_TAG}
                        docker push ${ECR_REGISTRY}/${ECR_REPO}:frontend-${IMAGE_TAG}
                    """
                }
            }
        }

        // ─── 7. DEPLOY TO EC2 ───────────────────────────────────────────
        stage("Deploy to EC2") {
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: "EC2_SSH_KEY", keyFileVariable: "SSH_KEY", usernameVariable: "SSH_USER"),
                    string(credentialsId: "EC2_HOST", variable: "EC2_HOST"),
                    string(credentialsId: "DB_PASS", variable: "DB_PASS"),
                    [
                        $class: "AmazonWebServicesCredentialsBinding",
                        credentialsId: "AWS_CREDENTIALS",
                        accessKeyVariable: "AWS_ACCESS_KEY_ID",
                        secretKeyVariable: "AWS_SECRET_ACCESS_KEY"
                    ]
                ]) {
                    sh """
                        ssh -o StrictHostKeyChecking=no -i ${SSH_KEY} ubuntu@${EC2_HOST} << 'ENDSSH'
                            set -e

                            export AWS_REGION=${AWS_REGION}
                            export AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}
                            export AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
                            export AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
                            export ECR_REGISTRY=${ECR_REGISTRY}
                            export ECR_REPO=${ECR_REPO}
                            export IMAGE_TAG=${IMAGE_TAG}
                            export DB_PASS=${DB_PASS}

                            aws ecr get-login-password --region \$AWS_REGION \
                                | docker login --username AWS --password-stdin \$ECR_REGISTRY

                            cd /home/ubuntu/notes-app
                            git pull origin main

                            docker compose pull
                            docker compose up -d --remove-orphans
                            docker image prune -f
ENDSSH
                    """
                }
            }
        }
    }

    post {
        success {
            echo "✅ Build #${BUILD_NUMBER} deployed successfully."
        }
        failure {
            echo "❌ Build #${BUILD_NUMBER} failed. Check logs above."
        }
        always {
            sh """
                docker rmi ${ECR_REGISTRY}/${ECR_REPO}:api-gateway-${IMAGE_TAG}   2>/dev/null || true
                docker rmi ${ECR_REGISTRY}/${ECR_REPO}:user-service-${IMAGE_TAG}  2>/dev/null || true
                docker rmi ${ECR_REGISTRY}/${ECR_REPO}:notes-service-${IMAGE_TAG} 2>/dev/null || true
                docker rmi ${ECR_REGISTRY}/${ECR_REPO}:frontend-${IMAGE_TAG}      2>/dev/null || true
            """
        }
    }
}
