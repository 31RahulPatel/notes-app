pipeline {
    agent any

    tools {
        "hudson.plugins.sonar.SonarRunnerInstallation" "sonar-scanner"
    }

    environment {
        AWS_REGION      = "us-east-1"
        AWS_ACCOUNT_ID  = "836548370285"
        ECR_REGISTRY    = "836548370285.dkr.ecr.us-east-1.amazonaws.com"
        ECR_REPO        = "notes-app"
        IMAGE_TAG       = "${BUILD_NUMBER}"
        EC2_HOST        = credentials("EC2_HOST")
        DB_PASS         = credentials("DB_PASS")
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
                withSonarQubeEnv("SonarQube") {
                    withCredentials([string(credentialsId: "sonar-token", variable: "SONAR_TOKEN")]) {
                        sh '''
                            sonar-scanner \
                              -Dsonar.projectKey=notes-app \
                              -Dsonar.sources=. \
                              -Dsonar.exclusions=**/node_modules/**,**/package-lock.json \
                              -Dsonar.login=$SONAR_TOKEN
                        '''
                    }
                }
            }
        }

        // ─── 3. SONARQUBE QUALITY GATE ──────────────────────────────────
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
                    docker build -t ${ECR_REGISTRY}/${ECR_REPO}:api-gateway-${IMAGE_TAG}    ./api-gateway
                    docker build -t ${ECR_REGISTRY}/${ECR_REPO}:user-service-${IMAGE_TAG}   ./user-service
                    docker build -t ${ECR_REGISTRY}/${ECR_REPO}:notes-service-${IMAGE_TAG}  ./notes-service
                    docker build -t ${ECR_REGISTRY}/${ECR_REPO}:frontend-${IMAGE_TAG}       ./frontend
                """
            }
        }

        // ─── 5. TRIVY SCAN ──────────────────────────────────────────────
        stage("Trivy Image Scan") {
            steps {
                sh """
                    trivy image --exit-code 1 --severity HIGH,CRITICAL \
                        --no-progress ${ECR_REGISTRY}/${ECR_REPO}:api-gateway-${IMAGE_TAG}

                    trivy image --exit-code 1 --severity HIGH,CRITICAL \
                        --no-progress ${ECR_REGISTRY}/${ECR_REPO}:user-service-${IMAGE_TAG}

                    trivy image --exit-code 1 --severity HIGH,CRITICAL \
                        --no-progress ${ECR_REGISTRY}/${ECR_REPO}:notes-service-${IMAGE_TAG}

                    trivy image --exit-code 1 --severity HIGH,CRITICAL \
                        --no-progress ${ECR_REGISTRY}/${ECR_REPO}:frontend-${IMAGE_TAG}
                """
            }
        }

        // ─── 6. PUSH TO ECR ─────────────────────────────────────────────
        stage("Push to ECR") {
            steps {
                withAWS(region: "${AWS_REGION}", credentials: "AWS_CREDENTIALS") {
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
                sshagent(["EC2_SSH_KEY"]) {
                    sh """
                        ssh -o StrictHostKeyChecking=no ubuntu@${EC2_HOST} '
                            export AWS_REGION=${AWS_REGION}
                            export AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}
                            export ECR_REPO=${ECR_REPO}
                            export IMAGE_TAG=${IMAGE_TAG}
                            export DB_PASS=${DB_PASS}

                            aws ecr get-login-password --region ${AWS_REGION} \
                                | docker login --username AWS --password-stdin ${ECR_REGISTRY}

                            cd /home/ubuntu/notes-app
                            git pull origin main

                            docker compose pull
                            docker compose up -d --remove-orphans

                            docker image prune -f
                        '
                    """
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline completed. Build #${BUILD_NUMBER} deployed successfully."
        }
        failure {
            echo "Pipeline failed. Check logs above."
        }
        always {
            sh "docker rmi \$(docker images -q ${ECR_REGISTRY}/${ECR_REPO}) 2>/dev/null || true"
        }
    }
}
