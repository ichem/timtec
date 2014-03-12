(function(angular){
    'use strict';

    var app = angular.module('lesson.controllers', []);

    app.controller('MainCtrl', ['$scope', 'LessonData', 'Answer', 'Progress', '$location', 'youtubePlayerApi', 'resolveActivityTemplate',
        function ($scope, LessonData, Answer, Progress, $location, youtubePlayerApi, resolveActivityTemplate) {

            window.ga = window.ga || function(){ console.log(arguments); };

            youtubePlayerApi.events.onStateChange = function(event){
                window.onPlayerStateChange.call($scope.currentUnit, event);
                if (event.data === YT.PlayerState.ENDED) {
                    $scope.nextStep();
                    if(!$scope.$$phase) {
                        $scope.$apply();
                    }
                }
            };

            $scope.section = $scope.section || 'video';

            $scope.selectUnit = function(unit) {
                $scope.currentUnit = unit;
                if(unit.video) {
                    $scope.section = 'video';
                    $scope.play(unit.video.youtube_id);
                } else {
                    $scope.section = 'activity';
                }
                $scope.selectActivity(0);
            };

            $scope.nextUnit = function() {
                var index = $scope.lesson.units.indexOf($scope.currentUnit);
                index++;

                if(index < $scope.lesson.units.length) {
                    $location.path('/{0}'.format(index+1));
                }
                // e se não tiver nextUnit, faz o que?
            };

            $scope.play = function() {
                if($scope.currentUnit.video){
                    var youtube_id = $scope.currentUnit.video.youtube_id;
                    $scope.section = 'video';

                    youtubePlayerApi.loadPlayer().then(function(player){
                            if(player.getVideoData() &&
                                player.getVideoData().video_id === youtube_id) return;
                            player.cueVideoById(youtube_id);
                    });
                } else {
                    $scope.section = 'activity';
                }

            };

            $scope.selectActivity = function(index) {
                function _newAnswer(){
                    $scope.answer = new Answer();
                    if(angular.isArray($scope.currentActivity.expected)) {
                        $scope.answer.given = $scope.currentActivity.expected.map(function(){});
                    }
                }

                if($scope.currentUnit.activities && $scope.currentUnit.activities.length) {
                    $scope.currentActivity = $scope.currentUnit.activities[index];
                    $scope.activityTemplateUrl = resolveActivityTemplate($scope.currentActivity.type);

                    ga("send", "event", "activity", "select", $scope.currentActivity.id);

                    Answer.getLastGivenAnswer($scope.currentActivity.id)
                        .then(function(answer){
                            var exp = $scope.currentActivity.expected;
                            var giv = answer.given;

                            var shouldUseLastAnswer = (exp !== null && exp !== undefined) ||
                                (angular.isArray(exp) && angular.isArray(giv) && giv.length === exp.length);

                            if (shouldUseLastAnswer) {
                                $scope.answer = answer;
                            } else {
                                _newAnswer();
                            }

                        })['catch'](_newAnswer);
                } else {
                    $scope.currentActivity = null;
                    $scope.activityTemplateUrl = null;
                }
            };

            $scope.sendAnswer = function() {
                $scope.answer.activity = $scope.currentActivity.id;
                $scope.answer.saveOrUpdate().then(function(d){
                    ga('send', 'event', 'activity', 'result', '', d.correct);
                    return Progress.getProgressByUnitId($scope.currentUnit.id);
                }).then(function(progress){
                    $scope.currentUnit.progress = progress;
                });
                ga('send', 'event', 'activity', 'submit');
            };

            $scope.nextStep = function(skipComment) {
                if($scope.section === 'video') {
                    if(angular.isArray($scope.currentUnit.activities) &&
                        $scope.currentUnit.activities.length > 0) {
                        $scope.section = 'activity';
                    } else {
                        var progress = new Progress();
                        progress.complete = new Date();
                        progress.unit = $scope.currentUnit.id;
                        $scope.currentUnit.progress = progress;
                        progress.$save();
                        $scope.nextUnit();
                    }
                } else {
                    if($scope.section === 'activity' && !skipComment && $scope.currentActivity.comment) {
                        $scope.section = 'comment';
                    } else {
                        var index = $scope.currentUnit.activities.indexOf($scope.currentActivity);
                        if(index+1 === $scope.currentUnit.activities.length) {
                            $scope.nextUnit();
                        } else {
                            $scope.selectActivity(index + 1);
                            $scope.section = 'activity';
                        }
                    }
                }
            };

            var start;
            $scope.$watch('currentUnit', function(currentUnit, lastUnit) {
                if(!$scope.lesson) return;
                // Changing Unit means unit starting
                if (start && lastUnit) {
                    var end = new Date().getTime();
                    ga('send', 'event', 'unit', 'time in unit',
                       $scope.lesson.course + ' - "' + $scope.lesson.name + '" - ' + lastUnit.id,
                       end - start);
                }
                ga('send', 'event', 'unit', 'start', $scope.lesson.course + ' - ' + $scope.lesson.name, $scope.currentUnit.id);
                start = new Date().getTime();
            });

            LessonData.then(function(lesson){
                $scope.lesson = lesson;

                var index = /\/(\d+)/.extract($location.path(), 1);
                index = parseInt(index, 10) - 1 || 0;
                $scope.selectUnit(lesson.units[index]);
                $scope.play();

                $scope.$on('$locationChangeSuccess', function (event, newLoc, oldLoc){
                   index = /#\/(\d+)/.extract(document.location.hash, 1);
                   index = parseInt(index, 10) - 1 || 0;
                   $scope.selectUnit(lesson.units[index]);
                });
            });
        }
    ]);

})(angular);
